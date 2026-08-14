"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth, requireAdmin } from "@/lib/auth";
import { sendMail } from "@/lib/email/mailer";
import { leadReplyEmail } from "@/lib/email/lead-email";
import { getSettings } from "@/lib/settings";
import type { LeadStatus } from "@/types/db-enums";

const STATUSES: LeadStatus[] = ["NEW", "CONTACTED", "FOLLOW_UP", "QUALIFIED", "CONVERTED", "LOST"];

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
}

export async function updateLeadStatus(id: string, status: string) {
  const session = await requireAdmin();
  if (!STATUSES.includes(status as LeadStatus)) return { ok: false as const, error: "Invalid status" };

  const current = await prisma.lead.findUnique({ where: { id }, select: { status: true } });
  await prisma.lead.update({ where: { id }, data: { status: status as LeadStatus } });

  if (current && current.status !== status) {
    await logActivity({
      leadId: id,
      type: "STATUS",
      authorId: session.user?.id,
      body: `Status changed from ${current.status.replace(/_/g, " ")} to ${status.replace(/_/g, " ")}`,
    });
  }

  revalidatePath("/admin/leads");
  revalidatePath(`/admin/leads/${id}`);
  return { ok: true as const };
}

export async function addLeadNote(leadId: string, body: string) {
  const session = await auth();
  if (!session?.user) return { ok: false as const, error: "Not authorized" };
  if (!body.trim()) return { ok: false as const, error: "Note cannot be empty" };

  await logActivity({ leadId, type: "NOTE", body: body.trim(), authorId: session.user.id });
  revalidatePath(`/admin/leads/${leadId}`);
  return { ok: true as const };
}

/** Log a phone call against the lead (kept separate so calls are countable). */
export async function logLeadCall(leadId: string, body: string) {
  const session = await auth();
  if (!session?.user) return { ok: false as const, error: "Not authorized" };

  await logActivity({
    leadId,
    type: "CALL",
    body: body.trim() || "Called the customer",
    authorId: session.user.id,
  });
  revalidatePath(`/admin/leads/${leadId}`);
  return { ok: true as const };
}

/** Send an email to the lead from the admin panel and record it on the timeline. */
export async function sendLeadEmail(leadId: string, subject: string, message: string) {
  const session = await auth();
  if (!session?.user) return { ok: false as const, error: "Not authorized" };

  const cleanSubject = subject.trim();
  const cleanMessage = message.trim();
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
      senderName: session.user.name,
      phone: settings.phone || null,
      whatsapp: settings.whatsapp || null,
      siteUrl,
    }),
    replyTo: process.env.ADMIN_NOTIFY_EMAIL || undefined,
  });

  await logActivity({
    leadId,
    type: "EMAIL",
    authorId: session.user.id,
    subject: cleanSubject,
    emailTo: lead.email,
    delivered,
    body: cleanMessage,
  });

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
  const session = await auth();
  if (!session?.user) return { ok: false as const, error: "Not authorized" };

  if (!date) {
    await prisma.lead.update({ where: { id: leadId }, data: { nextFollowUpAt: null } });
    await logActivity({ leadId, type: "FOLLOWUP", body: "Follow-up reminder cleared", authorId: session.user.id });
  } else {
    const when = new Date(date);
    if (Number.isNaN(when.getTime())) return { ok: false as const, error: "Invalid date" };
    await prisma.lead.update({ where: { id: leadId }, data: { nextFollowUpAt: when } });
    await logActivity({
      leadId,
      type: "FOLLOWUP",
      authorId: session.user.id,
      body: `Follow-up set for ${when.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`,
    });
  }

  revalidatePath("/admin/leads");
  revalidatePath(`/admin/leads/${leadId}`);
  return { ok: true as const };
}

export async function deleteLead(id: string) {
  await requireAdmin();
  await prisma.lead.delete({ where: { id } });
  revalidatePath("/admin/leads");
  return { ok: true as const };
}
