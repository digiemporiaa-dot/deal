"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { guardAction, type AdminActor } from "@/lib/guard";
import { recordActivity } from "@/lib/activity";
import { toSafeError } from "@/lib/errors";
import { sendMail } from "@/lib/email/mailer";
import { leadReplyEmail } from "@/lib/email/lead-email";
import { leadAssignedEmail } from "@/lib/email/crm-emails";
import { getSettings } from "@/lib/settings";
import { isLeadOwnerOnly } from "@/lib/permissions";
import {
  LEAD_STATUSES,
  LEAD_PRIORITIES,
  leadStatusLabel,
  normalizePhone,
  parseTags,
  serializeTags,
  WON_STATUS,
} from "@/lib/crm";
import { rescoreLead } from "@/lib/services/lead-scoring";
import { convertLeadToCustomer, recordStatusChange } from "@/lib/services/lead-conversion";
import { findDuplicateLeads } from "@/lib/services/lead-dedupe";
import {
  createFollowUp as createFollowUpTask,
  completeFollowUp as completeFollowUpTask,
  rescheduleFollowUp as rescheduleFollowUpTask,
  deleteFollowUp as deleteFollowUpTask,
  syncNextFollowUp,
  followUpTypeLabel,
} from "@/lib/services/follow-up";
import {
  followUpSchema,
  completeFollowUpSchema,
  rescheduleFollowUpSchema,
  leadQualificationSchema,
} from "@/lib/validation";
import type { LeadStatus } from "@/types/db-enums";

const STATUSES: readonly LeadStatus[] = LEAD_STATUSES;

/**
 * How many leads may be converted in one bulk action.
 *
 * Each conversion is its own transaction — it may create a customer, write
 * history and stand follow-ups down — so this is deliberately far below the
 * 200 the other bulk statuses allow. Converting 200 leads in one request
 * would time out half-way and leave the rest untouched with no way to tell
 * which.
 */
const BULK_CONVERT_LIMIT = 25;

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

/**
 * Write one entry to the lead's activity timeline.
 *
 * Every interaction in this file funnels through here, which makes it the one
 * honest place to refresh the score: engagement and recency are both scoring
 * inputs, so a lead that was just called is warmer than one that was not.
 * `rescoreLead` swallows its own failures — a scoring problem must never roll
 * back the note that triggered it.
 */
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
  await rescoreLead(input.leadId);
}

/** Parse a form date, treating anything unparseable as "not given". */
function toDateOrNull(value: string | undefined | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** A human has engaged with this lead — stop the automatic nurture emails. */
async function stopSequence(leadId: string) {
  await prisma.lead.updateMany({
    where: { id: leadId, sequenceStoppedAt: null },
    data: { sequenceStoppedAt: new Date() },
  });
}

/* ───────────────────────── create ───────────────────────── */

const createLeadSchema = z.object({
  name: z.string().trim().min(2, "Enter the customer's name").max(120),
  phone: z.string().trim().min(6, "Enter a contact number").max(30),
  email: z.union([z.string().trim().email("Enter a valid email"), z.literal("")]).optional(),
  destination: z.string().trim().max(120).optional(),
  travelDate: z.string().trim().max(20).optional(),
  travellers: z.coerce.number().int().min(1).max(99).optional(),
  budget: z.string().trim().max(60).optional(),
  message: z.string().trim().max(2000).optional(),
  priority: z.enum(LEAD_PRIORITIES).default("NORMAL"),
  assignedToId: z.string().trim().max(40).optional(),
});

/**
 * Create a lead by hand.
 *
 * Enquiries normally arrive from the website form, but a travel desk also
 * takes them by phone and at counters — without this, those get typed into a
 * notebook and never reach the pipeline. The source is recorded as "manual"
 * so they never inflate the marketing attribution reports.
 *
 * A sales executive who may only work their own leads gets the new lead
 * assigned to themselves, whatever the form said.
 */
export async function createLead(input: z.infer<typeof createLeadSchema>) {
  const guard = await guardAction("leads:create");
  if (!guard.ok) return { ok: false as const, error: guard.error };

  const parsed = createLeadSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message || "Check the form." };
  }

  const data = parsed.data;

  try {
    const ownerOnly = isLeadOwnerOnly(guard.actor.role);
    const assignedToId = ownerOnly
      ? guard.actor.id
      : data.assignedToId && data.assignedToId !== ""
        ? data.assignedToId
        : null;

    // Only assign to a real, active user — a stale id from the form would
    // otherwise fail the foreign key at insert time.
    const owner = assignedToId
      ? await prisma.user.findFirst({
          where: { id: assignedToId, isActive: true },
          select: { id: true },
        })
      : null;

    const travelDate = data.travelDate ? new Date(data.travelDate) : null;

    // Flagged for the person typing it in, never blocked — a repeat customer
    // is good news, and refusing the entry would send them back to a notebook.
    const duplicates = await findDuplicateLeads({
      phone: data.phone,
      email: data.email || null,
      limit: 3,
    });

    const lead = await prisma.lead.create({
      data: {
        name: data.name,
        phone: data.phone,
        phoneKey: normalizePhone(data.phone),
        email: data.email || null,
        destination: data.destination || null,
        travelDate: travelDate && !Number.isNaN(travelDate.getTime()) ? travelDate : null,
        travellers: data.travellers ?? null,
        budget: data.budget || null,
        message: data.message || null,
        priority: data.priority,
        status: "NEW",
        source: "manual",
        assignedToId: owner?.id ?? null,
        lastActivityAt: new Date(),
      },
      select: { id: true, name: true },
    });

    if (duplicates.isDuplicate) {
      await logActivity({
        leadId: lead.id,
        type: "DUPLICATE",
        authorId: guard.actor.id,
        body: `Possible duplicate of: ${duplicates.leads
          .map((row) => `${row.name} (${row.statusLabel})`)
          .join(", ")}`,
      });
    }

    await logActivity({
      leadId: lead.id,
      type: "NOTE",
      authorId: guard.actor.id,
      body: `Lead added manually by ${guard.actor.name || "an admin"}`,
    });

    await recordActivity({
      actor: guard.actor,
      action: "CREATE",
      entity: "Lead",
      entityId: lead.id,
      description: `Added lead "${lead.name}"`,
    });

    revalidatePath("/admin/leads");
    return {
      ok: true as const,
      id: lead.id,
      duplicates: duplicates.leads.map((row) => ({
        id: row.id,
        name: row.name,
        statusLabel: row.statusLabel,
        assignedToName: row.assignedToName,
      })),
    };
  } catch (err) {
    return { ok: false as const, error: toSafeError(err, "action.createLead").message };
  }
}

/**
 * Move a lead through the pipeline.
 *
 * Every move is recorded in `LeadStatusChange` as well as on the timeline, so
 * stage duration and win/loss velocity can be measured rather than inferred
 * from `updatedAt`. Two statuses do more than change a word:
 *
 *   Won  — converts the lead into a customer, reusing an existing record when
 *          the email or phone already belongs to one.
 *   Lost — requires a reason, which is stored on the lead so the loss can be
 *          reported on instead of forgotten.
 *
 * Closing a lead in any way also stands its follow-up queue down.
 */
export async function updateLeadStatus(id: string, status: string, reason?: string) {
  const guard = await authorizeLead(id);
  if (!guard.ok) return { ok: false as const, error: guard.error };
  if (!STATUSES.includes(status as LeadStatus)) return { ok: false as const, error: "Invalid status" };

  const current = await prisma.lead.findUnique({ where: { id }, select: { status: true, name: true } });
  if (!current) return { ok: false as const, error: "Lead not found" };

  const note = reason?.trim().slice(0, 500) || null;
  if (status === "LOST" && !note) {
    return { ok: false as const, error: "Say why the lead was lost." };
  }

  if (current.status === status) {
    // Nothing moved. Still stop the sequence — a human has clearly engaged.
    await stopSequence(id);
    return { ok: true as const, changed: false };
  }

  let convertedCustomerId: string | null = null;

  if (status === WON_STATUS) {
    // Conversion sets the status, writes the history entry and closes the
    // follow-ups in one transaction, so it must not be done twice.
    const result = await convertLeadToCustomer({ leadId: id, actor: guard.actor, reason: note });
    if (!result.ok) return { ok: false as const, error: result.error };
    convertedCustomerId = result.customerId;
  } else {
    await recordStatusChange({
      leadId: id,
      fromStatus: current.status,
      toStatus: status,
      actor: guard.actor,
      reason: note,
    });
  }

  await stopSequence(id);

  await logActivity({
    leadId: id,
    type: "STATUS",
    authorId: guard.actor.id,
    body: note
      ? `Status changed from ${leadStatusLabel(current.status)} to ${leadStatusLabel(status)} — ${note}`
      : `Status changed from ${leadStatusLabel(current.status)} to ${leadStatusLabel(status)}`,
  });

  await recordActivity({
    actor: guard.actor,
    action: "STATUS_CHANGE",
    entity: "Lead",
    entityId: id,
    description: `Moved lead "${current.name}" to ${leadStatusLabel(status)}`,
    metadata: { from: current.status, to: status, reason: note, customerId: convertedCustomerId },
  });

  revalidatePath("/admin/leads");
  revalidatePath(`/admin/leads/${id}`);
  if (convertedCustomerId) revalidatePath("/admin/customers");
  return { ok: true as const, changed: true, customerId: convertedCustomerId };
}

/**
 * Convert a lead into a customer without going through the status dropdown.
 *
 * Same code path as moving to Won, and just as safe to call twice: the second
 * call reports the customer that already exists and changes nothing.
 */
export async function convertLead(id: string, reason?: string) {
  const guard = await authorizeLead(id);
  if (!guard.ok) return { ok: false as const, error: guard.error };

  const lead = await prisma.lead.findUnique({ where: { id }, select: { name: true, status: true } });
  if (!lead) return { ok: false as const, error: "Lead not found" };

  const result = await convertLeadToCustomer({
    leadId: id,
    actor: guard.actor,
    reason: reason?.trim().slice(0, 500) || null,
  });
  if (!result.ok) return { ok: false as const, error: result.error };

  if (result.changed) {
    await stopSequence(id);
    await recordActivity({
      actor: guard.actor,
      action: "STATUS_CHANGE",
      entity: "Lead",
      entityId: id,
      description: `Converted lead "${lead.name}" to customer ${result.customerName}`,
      metadata: {
        from: lead.status,
        to: WON_STATUS,
        customerId: result.customerId,
        matchedExisting: result.matchedExisting,
      },
    });
    await rescoreLead(id);
  }

  revalidatePath("/admin/leads");
  revalidatePath(`/admin/leads/${id}`);
  revalidatePath("/admin/customers");

  return {
    ok: true as const,
    customerId: result.customerId,
    customerName: result.customerName,
    changed: result.changed,
    matchedExisting: result.matchedExisting,
  };
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

/** How a follow-up date reads on the timeline. */
function formatDue(date: Date): string {
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Set or clear the next follow-up date. Pass an empty string to clear it.
 *
 * Kept for the existing quick-date control, but it no longer writes
 * `Lead.nextFollowUpAt` itself — that column is derived from the pending
 * follow-up tasks now. Setting a date creates a task; clearing cancels the
 * pending ones. Either way the column ends up right, and the lead gains a
 * record of what the follow-up was for.
 */
export async function setLeadFollowUp(leadId: string, date: string) {
  const guard = await authorizeLead(leadId);
  if (!guard.ok) return { ok: false as const, error: guard.error };

  if (!date) {
    const cancelled = await prisma.leadFollowUp.updateMany({
      where: { leadId, status: "PENDING" },
      data: { status: "CANCELLED", completedAt: new Date(), outcome: "Reminder cleared" },
    });
    await syncNextFollowUp(leadId);
    if (cancelled.count > 0) {
      await logActivity({
        leadId,
        type: "FOLLOWUP",
        body: "Follow-up reminder cleared",
        authorId: guard.actor.id,
      });
    }
  } else {
    const when = new Date(date);
    if (Number.isNaN(when.getTime())) return { ok: false as const, error: "Invalid date" };

    const created = await createFollowUpTask({
      leadId,
      dueAt: when,
      type: "CALL",
      title: "Follow up",
      createdById: guard.actor.id,
    });
    if (!created.ok) return { ok: false as const, error: created.error };

    await logActivity({
      leadId,
      type: "FOLLOWUP",
      authorId: guard.actor.id,
      body: `Follow-up set for ${formatDue(when)}`,
    });
  }

  revalidatePath("/admin/leads");
  revalidatePath(`/admin/leads/${leadId}`);
  return { ok: true as const };
}

/* ─────────────────────── qualification ─────────────────────── */

/**
 * Save what the trip actually is.
 *
 * This is the qualification step a travel desk does on the phone — which
 * destination, which package, how many rooms, what kind of trip — and until
 * now there was nowhere to put most of it. Every field is optional: a
 * half-qualified lead is normal and must still save.
 *
 * `packageId` and `destinationId` arrive from a form, so both are checked
 * against real rows rather than written straight through; an id that no
 * longer exists is dropped rather than failing the foreign key. Saving
 * rescores the lead, because nearly everything here feeds the score.
 */
export async function updateLeadQualification(leadId: string, input: unknown) {
  const guard = await authorizeLead(leadId);
  if (!guard.ok) return { ok: false as const, error: guard.error };

  const parsed = leadQualificationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message || "Check the form." };
  }
  const data = parsed.data;

  const current = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { name: true, destination: true, budget: true, tripType: true },
  });
  if (!current) return { ok: false as const, error: "Lead not found" };

  // Verified, not trusted: a stale id from a cached form would otherwise
  // fail at insert time with a foreign-key error the user cannot act on.
  const pkg = data.packageId
    ? await prisma.travelPackage.findUnique({
        where: { id: data.packageId },
        select: { id: true, destinationId: true },
      })
    : null;

  const destinationId = data.destinationId
    ? (
        await prisma.destination.findUnique({
          where: { id: data.destinationId },
          select: { id: true },
        })
      )?.id ?? null
    : null;

  try {
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        destination: data.destination || null,
        // A package implies its destination, so picking one fills the other
        // in rather than leaving the two able to contradict each other.
        destinationId: destinationId ?? pkg?.destinationId ?? null,
        packageId: pkg?.id ?? null,
        travelDate: toDateOrNull(data.travelDate),
        returnDate: toDateOrNull(data.returnDate),
        adults: data.adults ?? null,
        children: data.children ?? null,
        rooms: data.rooms ?? null,
        budget: data.budget || null,
        tripType: data.tripType || null,
        ...(data.tags ? { tags: serializeTags(data.tags) } : {}),
      },
    });

    await logActivity({
      leadId,
      type: "NOTE",
      authorId: guard.actor.id,
      body: `Trip details updated by ${guard.actor.name || "an admin"}`,
    });

    await recordActivity({
      actor: guard.actor,
      action: "UPDATE",
      entity: "Lead",
      entityId: leadId,
      description: `Updated trip details on lead "${current.name}"`,
      metadata: {
        destination: data.destination || null,
        packageId: pkg?.id ?? null,
        tripType: data.tripType || null,
      },
    });

    revalidatePath("/admin/leads");
    revalidatePath(`/admin/leads/${leadId}`);
    return { ok: true as const };
  } catch (err) {
    return {
      ok: false as const,
      error: toSafeError(err, "action.updateLeadQualification", { leadId }).message,
    };
  }
}

/** Replace a lead's tags. Normalising and de-duplicating happens server-side. */
export async function setLeadTags(leadId: string, tags: unknown) {
  const guard = await authorizeLead(leadId);
  if (!guard.ok) return { ok: false as const, error: guard.error };

  const parsed = z.array(z.string().trim().max(40)).max(20).safeParse(tags);
  if (!parsed.success) return { ok: false as const, error: "Those tags are not valid." };

  await prisma.lead.update({
    where: { id: leadId },
    data: { tags: serializeTags(parsed.data) },
  });

  revalidatePath("/admin/leads");
  revalidatePath(`/admin/leads/${leadId}`);
  return { ok: true as const, tags: parseTags(serializeTags(parsed.data)) };
}

/**
 * Look for existing leads with the same phone or email.
 *
 * Called from the new-lead form as the contact details are typed, so the
 * person sees "you already have this enquiry" before they finish rather than
 * after they submit. Behind `leads:create`, because knowing which numbers are
 * already in the CRM is itself information.
 */
export async function checkLeadDuplicates(phone: string, email: string) {
  const guard = await guardAction("leads:create");
  if (!guard.ok) return { ok: false as const, error: guard.error };

  const result = await findDuplicateLeads({ phone, email, limit: 3 });
  return {
    ok: true as const,
    leads: result.leads.map((row) => ({
      id: row.id,
      name: row.name,
      statusLabel: row.statusLabel,
      assignedToName: row.assignedToName,
      matchedOn: row.matchedOn,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

/* ─────────────────────── follow-up tasks ─────────────────────── */

/**
 * Schedule a named piece of follow-up work.
 *
 * `assignedToId` arrives from a form and is never trusted: the service
 * verifies it against a real active user and falls back to the lead's owner.
 * A role that works only its own pipeline is stopped by `authorizeLead`
 * before any of that, and cannot park work on somebody else's lead.
 */
export async function createLeadFollowUp(input: unknown) {
  const parsed = followUpSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message || "Check the form." };
  }
  const data = parsed.data;

  const guard = await authorizeLead(data.leadId);
  if (!guard.ok) return { ok: false as const, error: guard.error };

  // An owner-only role may schedule work, but only on itself.
  const assignedToId = isLeadOwnerOnly(guard.actor.role)
    ? guard.actor.id
    : data.assignedToId || null;

  const created = await createFollowUpTask({
    leadId: data.leadId,
    dueAt: new Date(data.dueAt),
    type: data.type,
    title: data.title,
    note: data.note || null,
    assignedToId,
    createdById: guard.actor.id,
  });
  if (!created.ok) return { ok: false as const, error: created.error };

  await logActivity({
    leadId: data.leadId,
    type: "FOLLOWUP",
    authorId: guard.actor.id,
    body: `${followUpTypeLabel(data.type)} scheduled for ${formatDue(created.followUp.dueAt)} — ${created.followUp.title}`,
  });
  await stopSequence(data.leadId);

  revalidatePath("/admin/leads");
  revalidatePath("/admin/follow-ups");
  revalidatePath(`/admin/leads/${data.leadId}`);
  return { ok: true as const, id: created.followUp.id };
}

/** Mark a follow-up done (or cancelled), with what came of it. */
export async function completeLeadFollowUp(input: unknown) {
  const parsed = completeFollowUpSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message || "Check the form." };
  }
  const data = parsed.data;

  // The follow-up id comes from the client, so the lead it belongs to is read
  // from the database and authorised — not taken from the request.
  const followUp = await prisma.leadFollowUp.findUnique({
    where: { id: data.id },
    select: { leadId: true },
  });
  if (!followUp) return { ok: false as const, error: "Follow-up not found" };

  const guard = await authorizeLead(followUp.leadId);
  if (!guard.ok) return { ok: false as const, error: guard.error };

  const result = await completeFollowUpTask({
    id: data.id,
    outcome: data.outcome || null,
    status: data.status,
  });
  if (!result.ok) return { ok: false as const, error: result.error };

  // Only log when this call is what closed it — a retry must not write a
  // second timeline entry.
  if (result.changed) {
    await logActivity({
      leadId: result.leadId,
      type: "FOLLOWUP",
      authorId: guard.actor.id,
      body:
        data.status === "CANCELLED"
          ? `Cancelled follow-up: ${result.title}`
          : `Completed follow-up: ${result.title}${data.outcome ? ` — ${data.outcome}` : ""}`,
    });
  }

  revalidatePath("/admin/leads");
  revalidatePath("/admin/follow-ups");
  revalidatePath(`/admin/leads/${result.leadId}`);
  return { ok: true as const, changed: result.changed };
}

/** Push a pending follow-up to a new date. */
export async function rescheduleLeadFollowUp(input: unknown) {
  const parsed = rescheduleFollowUpSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message || "Check the form." };
  }
  const data = parsed.data;

  const followUp = await prisma.leadFollowUp.findUnique({
    where: { id: data.id },
    select: { leadId: true, title: true },
  });
  if (!followUp) return { ok: false as const, error: "Follow-up not found" };

  const guard = await authorizeLead(followUp.leadId);
  if (!guard.ok) return { ok: false as const, error: guard.error };

  const when = new Date(data.dueAt);
  const result = await rescheduleFollowUpTask({ id: data.id, dueAt: when });
  if (!result.ok) return { ok: false as const, error: result.error };

  await logActivity({
    leadId: result.leadId,
    type: "FOLLOWUP",
    authorId: guard.actor.id,
    body: `Moved "${followUp.title}" to ${formatDue(when)}`,
  });

  revalidatePath("/admin/leads");
  revalidatePath("/admin/follow-ups");
  revalidatePath(`/admin/leads/${result.leadId}`);
  return { ok: true as const };
}

/**
 * Push a follow-up out by a number of days.
 *
 * The new date is computed on the server, from the server's clock, rather
 * than sent by the browser — "tomorrow" has to mean tomorrow, not whatever
 * a laptop with the wrong date thinks. Snoozing measures from now, not from
 * the original due date, so snoozing a task that is a week late moves it to
 * tomorrow rather than to last Tuesday.
 */
export async function snoozeLeadFollowUp(id: string, days: number) {
  const requested = Number(days);
  if (!Number.isFinite(requested) || requested < 1 || requested > 90) {
    return { ok: false as const, error: "Pick between 1 and 90 days." };
  }

  const followUp = await prisma.leadFollowUp.findUnique({
    where: { id },
    select: { leadId: true, title: true, status: true },
  });
  if (!followUp) return { ok: false as const, error: "Follow-up not found" };

  const guard = await authorizeLead(followUp.leadId);
  if (!guard.ok) return { ok: false as const, error: guard.error };

  const when = new Date();
  when.setDate(when.getDate() + Math.round(requested));
  when.setHours(10, 0, 0, 0);

  const result = await rescheduleFollowUpTask({ id, dueAt: when });
  if (!result.ok) return { ok: false as const, error: result.error };

  await logActivity({
    leadId: result.leadId,
    type: "FOLLOWUP",
    authorId: guard.actor.id,
    body: `Moved "${followUp.title}" to ${formatDue(when)}`,
  });

  revalidatePath("/admin/leads");
  revalidatePath("/admin/follow-ups");
  revalidatePath("/admin/follow-ups");
  revalidatePath(`/admin/leads/${result.leadId}`);
  return { ok: true as const };
}

/**
 * Close several follow-ups at once, from the queue.
 *
 * Each one is authorised on its own lead rather than as a batch: the ids come
 * from the browser, and a restricted role must not be able to clear a
 * colleague's task by including its id in the list. Tasks the caller may not
 * touch are skipped and counted, not refused outright — one bad id should not
 * throw away the rest of the click.
 */
export async function completeLeadFollowUps(ids: string[]) {
  const guard = await guardAction("leads:update");
  if (!guard.ok) return { ok: false as const, error: guard.error };

  const unique = [...new Set(ids)].filter(Boolean).slice(0, 100);
  if (unique.length === 0) return { ok: false as const, error: "Select at least one follow-up" };

  const rows = await prisma.leadFollowUp.findMany({
    where: {
      id: { in: unique },
      status: "PENDING",
      // Ownership is re-read from the lead, never taken from the request.
      ...(isLeadOwnerOnly(guard.actor.role) ? { lead: { assignedToId: guard.actor.id } } : {}),
    },
    select: { id: true, leadId: true, title: true },
  });

  let done = 0;
  for (const row of rows) {
    const result = await completeFollowUpTask({ id: row.id, status: "DONE" });
    if (!result.ok || !result.changed) continue;
    done += 1;
    await logActivity({
      leadId: row.leadId,
      type: "FOLLOWUP",
      authorId: guard.actor.id,
      body: `Completed follow-up: ${row.title}`,
    });
  }

  await recordActivity({
    actor: guard.actor,
    action: "UPDATE",
    entity: "Lead",
    description: `Completed ${done} follow-up${done === 1 ? "" : "s"}`,
    metadata: { done, requested: unique.length },
  });

  revalidatePath("/admin/leads");
  revalidatePath("/admin/follow-ups");
  return { ok: true as const, count: done, skipped: unique.length - done };
}

/** Remove a follow-up created by mistake. */
export async function deleteLeadFollowUp(id: string) {
  const followUp = await prisma.leadFollowUp.findUnique({
    where: { id },
    select: { leadId: true },
  });
  if (!followUp) return { ok: false as const, error: "Follow-up not found" };

  const guard = await authorizeLead(followUp.leadId);
  if (!guard.ok) return { ok: false as const, error: guard.error };

  const result = await deleteFollowUpTask(id);
  if (!result.ok) return { ok: false as const, error: result.error };

  revalidatePath("/admin/leads");
  revalidatePath("/admin/follow-ups");
  revalidatePath(`/admin/leads/${result.leadId}`);
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

/**
 * Apply one status to several leads at once from the CRM list.
 *
 * Moving to Won is not a field update — it creates or links a customer per
 * lead — so it runs one conversion at a time and is capped lower than the
 * other statuses. Everything else is a single `updateMany` plus one history
 * row per lead that actually moved.
 */
export async function bulkUpdateLeadStatus(ids: string[], status: string, reason?: string) {
  const guard = await guardAction("leads:update");
  if (!guard.ok) return { ok: false as const, error: guard.error };
  if (!STATUSES.includes(status as LeadStatus)) return { ok: false as const, error: "Invalid status" };

  const converting = status === WON_STATUS;
  const unique = [...new Set(ids)].filter(Boolean).slice(0, converting ? BULK_CONVERT_LIMIT : 200);
  if (unique.length === 0) return { ok: false as const, error: "Select at least one lead" };

  const note = reason?.trim().slice(0, 500) || null;
  if (status === "LOST" && !note) {
    return { ok: false as const, error: "Say why these leads were lost." };
  }

  // Owner-restricted roles may only touch their own leads, whatever ids
  // arrive from the browser. Re-read rather than trusted.
  const where = isLeadOwnerOnly(guard.actor.role)
    ? { id: { in: unique }, assignedToId: guard.actor.id }
    : { id: { in: unique } };

  // Only the leads that are actually moving, so the history table does not
  // fill with no-op entries and the count is honest.
  const moving = await prisma.lead.findMany({
    where: { ...where, NOT: { status } },
    select: { id: true, status: true },
  });

  if (moving.length === 0) {
    return { ok: true as const, count: 0, requested: unique.length };
  }

  let count = 0;

  if (converting) {
    for (const lead of moving) {
      const result = await convertLeadToCustomer({ leadId: lead.id, actor: guard.actor, reason: note });
      if (result.ok && result.changed) count += 1;
    }
  } else {
    for (const lead of moving) {
      await recordStatusChange({
        leadId: lead.id,
        fromStatus: lead.status,
        toStatus: status,
        actor: guard.actor,
        reason: note,
      });
      count += 1;
    }
  }

  await recordActivity({
    actor: guard.actor,
    action: "STATUS_CHANGE",
    entity: "Lead",
    description: `Bulk-updated ${count} lead(s) to ${leadStatusLabel(status)}`,
    metadata: { count, requested: unique.length, status, reason: note },
  });

  revalidatePath("/admin/leads");
  if (converting) revalidatePath("/admin/customers");
  return { ok: true as const, count, requested: unique.length };
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
