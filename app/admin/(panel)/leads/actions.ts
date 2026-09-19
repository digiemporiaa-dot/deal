"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { guardAction, type AdminActor } from "@/lib/guard";
import { recordActivity } from "@/lib/activity";
import { toSafeError } from "@/lib/errors";
import { sendMail } from "@/lib/email/mailer";
import { leadReplyEmail } from "@/lib/email/lead-email";
import { leadAssignedEmail } from "@/lib/email/crm-emails";
import { getSettings } from "@/lib/settings";
import { isLeadOwnerOnly } from "@/lib/permissions";
import { LEAD_STATUSES, LEAD_PRIORITIES } from "@/lib/crm";
import type { LeadStatus } from "@/types/db-enums";

const STATUSES: readonly LeadStatus[] = LEAD_STATUSES;

/**
 * Confirms the signed-in user may act on this lead.
 *
 * Two independent checks: the role must carry `leads:update`, and — for roles
 * that work only their own pipeline — the lead must actually be assigned to
 * them. The lead id comes from the client, so ownership is re-read from the
 * database on every call rather than trusted.
 */
async function authorizeLead(
  leadId: string,
): Promise<{ ok: true; actor: AdminActor } | { ok: false; error: string }> {
  const guard = await guardAction("leads:update");
  if (!guard.ok) return guard;

  if (isLeadOwnerOnly(guard.actor.role)) {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { assignedToId: true },
    });
    if (!lead || lead.assignedToId !== guard.actor.id) {
      return { ok: false, error: "This lead is not assigned to you." };
    }
  }
  return guard;
}

/** Write one entry to the lead's activity timeline. */
async function logActivity(input: {
  leadId: string;
  body: string;
  type: string;
  authorId?: string | null;
  subject?: string | null;
  emailTo?: string | null;
  delivered?: boolean;
}) {
  await prisma.leadNote.create({
    data: {
      leadId: input.leadId,
      body: input.body,
      type: input.type,
      authorId: input.authorId ?? null,
      subject: input.subject ?? null,
      emailTo: input.emailTo ?? null,
      delivered: input.delivered ?? true,
    },
  });
  // Keeps "last activity" sortable without counting notes on every query.
  await prisma.lead.update({
    where: { id: input.leadId },
    data: { lastActivityAt: new Date() },
  });
}

/** A human has engaged with this lead — stop the automatic nurture emails. */
async function stopSequence(leadId: string) {
  await prisma.lead.updateMany({
    where: { id: leadId, sequenceStoppedAt: null },
    data: { sequenceStoppedAt: new Date() },
  });
}

export async function updateLeadStatus(id: string, status: string) {
  const guard = await authorizeLead(id);
  if (!guard.ok) return { ok: false as const, error: guard.error };
  if (!STATUSES.includes(status as LeadStatus)) return { ok: false as const, error: "Invalid status" };

  const current = await prisma.lead.findUnique({ where: { id }, select: { status: true, name: true } });
  if (!current) return { ok: false as const, error: "Lead not found" };

  await prisma.lead.update({ where: { id }, data: { status: status as LeadStatus } });
  await stopSequence(id);

  if (current.status !== status) {
    await logActivity({
      leadId: id,
      type: "STATUS",
      authorId: guard.actor.id,
      body: `Status changed from ${current.status.replace(/_/g, " ")} to ${status.replace(/_/g, " ")}`,
    });
    await recordActivity({
      actor: guard.actor,
      action: "STATUS_CHANGE",
      entity: "Lead",
      entityId: id,
      description: `Moved lead "${current.name}" to ${status.replace(/_/g, " ")}`,
      metadata: { from: current.status, to: status },
    });
  }

  revalidatePath("/admin/leads");
  revalidatePath(`/admin/leads/${id}`);
  return { ok: true as const };
}

/** Set how urgent a lead is. Drives the CRM priority filter. */
export async function updateLeadPriority(id: string, priority: string) {
  const guard = await authorizeLead(id);
  if (!guard.ok) return { ok: false as const, error: guard.error };
  if (!(LEAD_PRIORITIES as readonly string[]).includes(priority)) {
    return { ok: false as const, error: "Invalid priority" };
  }

  const current = await prisma.lead.findUnique({ where: { id }, select: { priority: true, name: true } });
  if (!current) return { ok: false as const, error: "Lead not found" };
  if (current.priority === priority) return { ok: true as const };

  await prisma.lead.update({ where: { id }, data: { priority } });
  await logActivity({
    leadId: id,
    type: "STATUS",
    authorId: guard.actor.id,
    body: `Priority changed from ${current.priority} to ${priority}`,
  });
  await recordActivity({
    actor: guard.actor,
    action: "UPDATE",
    entity: "Lead",
    entityId: id,
    description: `Set priority ${priority} on lead "${current.name}"`,
    metadata: { from: current.priority, to: priority },
  });

  revalidatePath("/admin/leads");
  revalidatePath(`/admin/leads/${id}`);
  return { ok: true as const };
}

export async function addLeadNote(leadId: string, body: string) {
  const guard = await authorizeLead(leadId);
  if (!guard.ok) return { ok: false as const, error: guard.error };
  const note = body.trim().slice(0, 5000);
  if (!note) return { ok: false as const, error: "Note cannot be empty" };

  await logActivity({ leadId, type: "NOTE", body: note, authorId: guard.actor.id });
  await stopSequence(leadId);
  revalidatePath(`/admin/leads/${leadId}`);
  return { ok: true as const };
}

/** Log a phone call against the lead (kept separate so calls are countable). */
export async function logLeadCall(leadId: string, body: string) {
  const guard = await authorizeLead(leadId);
  if (!guard.ok) return { ok: false as const, error: guard.error };

  await logActivity({
    leadId,
    type: "CALL",
    body: body.trim().slice(0, 5000) || "Called the customer",
    authorId: guard.actor.id,
  });
  await stopSequence(leadId);
  revalidatePath(`/admin/leads/${leadId}`);
  return { ok: true as const };
}

/** Send an email to the lead from the admin panel and record it on the timeline. */
export async function sendLeadEmail(leadId: string, subject: string, message: string) {
  const guard = await authorizeLead(leadId);
  if (!guard.ok) return { ok: false as const, error: guard.error };

  const cleanSubject = subject.trim().slice(0, 200);
  const cleanMessage = message.trim().slice(0, 10000);
  if (!cleanSubject) return { ok: false as const, error: "Subject is required" };
  if (!cleanMessage) return { ok: false as const, error: "Message is required" };

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return { ok: false as const, error: "Lead not found" };
  if (!lead.email) return { ok: false as const, error: "This lead has no email address" };

  const settings = await getSettings();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || null;

  const delivered = await sendMail({
    to: lead.email,
    subject: cleanSubject,
    html: leadReplyEmail({
      siteName: settings.siteName,
      leadName: lead.name,
      message: cleanMessage,
      senderName: guard.actor.name,
      phone: settings.phone || null,
      whatsapp: settings.whatsapp || null,
      siteUrl,
    }),
    replyTo: process.env.ADMIN_NOTIFY_EMAIL || undefined,
  });

  await logActivity({
    leadId,
    type: "EMAIL",
    authorId: guard.actor.id,
    subject: cleanSubject,
    emailTo: lead.email,
    delivered,
    body: cleanMessage,
  });

  await recordActivity({
    actor: guard.actor,
    action: "UPDATE",
    entity: "Lead",
    entityId: leadId,
    description: `Emailed lead "${lead.name}" — ${cleanSubject}`,
    metadata: { delivered },
  });

  await stopSequence(leadId);

  // First outreach moves an untouched lead forward automatically.
  if (delivered && lead.status === "NEW") {
    await prisma.lead.update({ where: { id: leadId }, data: { status: "CONTACTED" } });
  }

  revalidatePath("/admin/leads");
  revalidatePath(`/admin/leads/${leadId}`);

  return delivered
    ? { ok: true as const }
    : {
        ok: false as const,
        error:
          "Email could not be sent — check the SMTP settings in Vercel. The attempt has been recorded on the timeline.",
      };
}

/** Set or clear the next follow-up date. Pass an empty string to clear it. */
export async function setLeadFollowUp(leadId: string, date: string) {
  const guard = await authorizeLead(leadId);
  if (!guard.ok) return { ok: false as const, error: guard.error };

  if (!date) {
    await prisma.lead.update({ where: { id: leadId }, data: { nextFollowUpAt: null } });
    await logActivity({ leadId, type: "FOLLOWUP", body: "Follow-up reminder cleared", authorId: guard.actor.id });
  } else {
    const when = new Date(date);
    if (Number.isNaN(when.getTime())) return { ok: false as const, error: "Invalid date" };
    await prisma.lead.update({ where: { id: leadId }, data: { nextFollowUpAt: when } });
    await logActivity({
      leadId,
      type: "FOLLOWUP",
      authorId: guard.actor.id,
      body: `Follow-up set for ${when.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`,
    });
  }

  revalidatePath("/admin/leads");
  revalidatePath(`/admin/leads/${leadId}`);
  return { ok: true as const };
}

/** Assign the lead to a team member, or pass an empty string to unassign. */
export async function assignLead(leadId: string, userId: string) {
  const guard = await guardAction("leads:assign");
  if (!guard.ok) return { ok: false as const, error: guard.error };

  const exists = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true } });
  if (!exists) return { ok: false as const, error: "Lead not found" };

  if (!userId) {
    await prisma.lead.update({ where: { id: leadId }, data: { assignedToId: null } });
    await logActivity({ leadId, type: "ASSIGN", body: "Lead unassigned", authorId: guard.actor.id });
    await recordActivity({
      actor: guard.actor,
      action: "ASSIGN",
      entity: "Lead",
      entityId: leadId,
      description: "Unassigned lead",
    });
  } else {
    const member = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, isActive: true },
    });
    if (!member || !member.isActive) return { ok: false as const, error: "That team member is not available" };

    const lead = await prisma.lead.update({ where: { id: leadId }, data: { assignedToId: userId } });
    await logActivity({ leadId, type: "ASSIGN", body: `Lead assigned to ${member.name}`, authorId: guard.actor.id });
    await recordActivity({
      actor: guard.actor,
      action: "ASSIGN",
      entity: "Lead",
      entityId: leadId,
      description: `Assigned lead "${lead.name}" to ${member.name}`,
      metadata: { assignedToId: userId },
    });

    // Tell the team member straight away — they should not have to check the panel.
    if (member.email) {
      const settings = await getSettings();
      const base = process.env.NEXT_PUBLIC_SITE_URL || "https://vacation-deal.vercel.app";
      void sendMail({
        to: member.email,
        subject: `New lead assigned: ${lead.name}`,
        html: leadAssignedEmail({
          siteName: settings.siteName,
          staffName: member.name,
          leadName: lead.name,
          phone: lead.phone,
          email: lead.email,
          destination: lead.destination,
          budget: lead.budget,
          message: lead.message,
          assignedBy: guard.actor.name || "Your manager",
          leadUrl: `${base}/admin/leads/${leadId}`,
        }),
      });
    }
  }

  revalidatePath("/admin/leads");
  revalidatePath(`/admin/leads/${leadId}`);
  return { ok: true as const };
}

export async function deleteLead(id: string) {
  const guard = await guardAction("leads:delete");
  if (!guard.ok) return { ok: false as const, error: guard.error };
  try {
    const lead = await prisma.lead.delete({ where: { id } });
    await recordActivity({
      actor: guard.actor,
      action: "DELETE",
      entity: "Lead",
      entityId: id,
      description: `Deleted lead "${lead.name}"`,
      metadata: { phone: lead.phone, status: lead.status },
    });
    revalidatePath("/admin/leads");
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: toSafeError(err, "action.deleteLead", { id }).message };
  }
}

/** Apply one status to several leads at once from the CRM list. */
export async function bulkUpdateLeadStatus(ids: string[], status: string) {
  const guard = await guardAction("leads:update");
  if (!guard.ok) return { ok: false as const, error: guard.error };
  if (!STATUSES.includes(status as LeadStatus)) return { ok: false as const, error: "Invalid status" };

  const unique = [...new Set(ids)].filter(Boolean).slice(0, 200);
  if (unique.length === 0) return { ok: false as const, error: "Select at least one lead" };

  // Owner-restricted roles may only touch their own leads, whatever ids
  // arrive from the browser.
  const where = isLeadOwnerOnly(guard.actor.role)
    ? { id: { in: unique }, assignedToId: guard.actor.id }
    : { id: { in: unique } };

  const result = await prisma.lead.updateMany({ where, data: { status } });

  await recordActivity({
    actor: guard.actor,
    action: "STATUS_CHANGE",
    entity: "Lead",
    description: `Bulk-updated ${result.count} lead(s) to ${status.replace(/_/g, " ")}`,
    metadata: { count: result.count, requested: unique.length, status },
  });

  revalidatePath("/admin/leads");
  return { ok: true as const, count: result.count };
}

/** Hand several leads to one team member at once. */
export async function bulkAssignLeads(ids: string[], userId: string) {
  const guard = await guardAction("leads:assign");
  if (!guard.ok) return { ok: false as const, error: guard.error };

  const unique = [...new Set(ids)].filter(Boolean).slice(0, 200);
  if (unique.length === 0) return { ok: false as const, error: "Select at least one lead" };

  if (userId) {
    const member = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, isActive: true },
    });
    if (!member?.isActive) return { ok: false as const, error: "That team member is not available" };
  }

  const result = await prisma.lead.updateMany({
    where: { id: { in: unique } },
    data: { assignedToId: userId || null },
  });

  await recordActivity({
    actor: guard.actor,
    action: "ASSIGN",
    entity: "Lead",
    description: `Bulk-assigned ${result.count} lead(s)`,
    metadata: { count: result.count, assignedToId: userId || null },
  });

  revalidatePath("/admin/leads");
  return { ok: true as const, count: result.count };
}
