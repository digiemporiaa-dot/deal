import "server-only";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { CLOSED_STATUSES } from "@/lib/crm";
import type { FollowUpStatus, FollowUpType } from "@/types/db-enums";
import type { Prisma } from "@prisma/client";

/**
 * The follow-up engine.
 *
 * Before this, a lead had exactly one reminder: `Lead.nextFollowUpAt`. Setting
 * a second one overwrote the first, there was no record of what the follow-up
 * was *for*, and nothing said whether it ever happened.
 *
 * `LeadFollowUp` fixes that without breaking anything that already reads the
 * old column. The rule is simple and enforced in one place:
 *
 *     Lead.nextFollowUpAt === the dueAt of the earliest PENDING follow-up,
 *                             or null when there are none.
 *
 * So the CRM list filters, the pipeline counters, the dashboard queue, the
 * reports and the cron digest all keep working untouched, while the new table
 * carries the detail. `syncNextFollowUp` is the only writer of that column;
 * anything that changes a task calls it afterwards.
 */

export const FOLLOW_UP_TYPES = ["CALL", "WHATSAPP", "EMAIL", "MEETING", "TASK"] as const;
export const FOLLOW_UP_STATUSES = ["PENDING", "DONE", "CANCELLED"] as const;

export const FOLLOW_UP_TYPE_LABELS: Record<string, string> = {
  CALL: "Call",
  WHATSAPP: "WhatsApp",
  EMAIL: "Email",
  MEETING: "Meeting",
  TASK: "Task",
};

export function followUpTypeLabel(type: string): string {
  return FOLLOW_UP_TYPE_LABELS[type] ?? type;
}

/**
 * Recompute `Lead.nextFollowUpAt` from the lead's pending tasks.
 *
 * Returns the new value. Safe to call as often as you like — it writes only
 * when the value actually changes, so it will not churn `updatedAt` on every
 * page load.
 */
export async function syncNextFollowUp(
  leadId: string,
  tx: Prisma.TransactionClient = prisma,
): Promise<Date | null> {
  const next = await tx.leadFollowUp.findFirst({
    where: { leadId, status: "PENDING" },
    orderBy: { dueAt: "asc" },
    select: { dueAt: true },
  });

  const value = next?.dueAt ?? null;

  // Compared in JavaScript rather than as a `NOT` in the where clause. The
  // obvious `updateMany({ where: { NOT: { nextFollowUpAt: value } } })` is
  // silently wrong: when the column is NULL, SQL evaluates `NOT (NULL = ?)`
  // to NULL rather than true, so the row is skipped and a lead's very first
  // follow-up never reaches the column. Costs one small read; cannot be got
  // subtly wrong by anyone reading it later.
  const lead = await tx.lead.findUnique({
    where: { id: leadId },
    select: { nextFollowUpAt: true },
  });
  if (!lead) return null;

  const current = lead.nextFollowUpAt?.getTime() ?? null;
  if (current !== (value?.getTime() ?? null)) {
    await tx.lead.update({ where: { id: leadId }, data: { nextFollowUpAt: value } });
  }

  return value;
}

export type CreateFollowUpInput = {
  leadId: string;
  dueAt: Date;
  type?: FollowUpType;
  title: string;
  note?: string | null;
  assignedToId?: string | null;
  createdById?: string | null;
};

/**
 * Schedule a piece of work on a lead.
 *
 * `assignedToId` is verified against a real, active user rather than trusted —
 * it arrives from a form, and a stale id would otherwise fail the foreign key
 * at insert time or quietly park the task on a deactivated account. When no
 * owner is given the task inherits the lead's.
 */
export async function createFollowUp(input: CreateFollowUpInput) {
  const lead = await prisma.lead.findUnique({
    where: { id: input.leadId },
    select: { id: true, assignedToId: true },
  });
  if (!lead) return { ok: false as const, error: "Lead not found" };

  let assignedToId = input.assignedToId ?? lead.assignedToId ?? null;
  if (assignedToId) {
    const owner = await prisma.user.findFirst({
      where: { id: assignedToId, isActive: true },
      select: { id: true },
    });
    assignedToId = owner?.id ?? null;
  }

  const followUp = await prisma.$transaction(async (tx) => {
    const created = await tx.leadFollowUp.create({
      data: {
        leadId: input.leadId,
        dueAt: input.dueAt,
        type: input.type ?? "CALL",
        title: input.title.trim().slice(0, 200) || "Follow up",
        note: input.note?.trim().slice(0, 2000) || null,
        assignedToId,
        createdById: input.createdById ?? null,
      },
    });
    await syncNextFollowUp(input.leadId, tx);
    return created;
  });

  return { ok: true as const, followUp };
}

/**
 * Close a follow-up.
 *
 * Guarded on `status: "PENDING"` so completing the same task twice — two
 * tabs, a double click, a retried request — settles it once and reports
 * honestly that the second attempt changed nothing.
 */
export async function completeFollowUp(input: {
  id: string;
  outcome?: string | null;
  status?: Extract<FollowUpStatus, "DONE" | "CANCELLED">;
}) {
  const existing = await prisma.leadFollowUp.findUnique({
    where: { id: input.id },
    select: { id: true, leadId: true, status: true, title: true, type: true },
  });
  if (!existing) return { ok: false as const, error: "Follow-up not found" };

  const result = await prisma.$transaction(async (tx) => {
    const settled = await tx.leadFollowUp.updateMany({
      where: { id: input.id, status: "PENDING" },
      data: {
        status: input.status ?? "DONE",
        completedAt: new Date(),
        outcome: input.outcome?.trim().slice(0, 2000) || null,
      },
    });
    await syncNextFollowUp(existing.leadId, tx);
    return settled.count;
  });

  return {
    ok: true as const,
    leadId: existing.leadId,
    title: existing.title,
    type: existing.type,
    /** False when it was already closed — the caller should not log it twice. */
    changed: result > 0,
  };
}

/** Move a pending follow-up to a new date. */
export async function rescheduleFollowUp(input: { id: string; dueAt: Date }) {
  const existing = await prisma.leadFollowUp.findUnique({
    where: { id: input.id },
    select: { id: true, leadId: true, status: true },
  });
  if (!existing) return { ok: false as const, error: "Follow-up not found" };
  if (existing.status !== "PENDING") {
    return { ok: false as const, error: "That follow-up is already closed" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.leadFollowUp.update({ where: { id: input.id }, data: { dueAt: input.dueAt } });
    await syncNextFollowUp(existing.leadId, tx);
  });

  return { ok: true as const, leadId: existing.leadId };
}

/** Delete a follow-up outright. Used when one was created by mistake. */
export async function deleteFollowUp(id: string) {
  const existing = await prisma.leadFollowUp.findUnique({
    where: { id },
    select: { id: true, leadId: true },
  });
  if (!existing) return { ok: false as const, error: "Follow-up not found" };

  await prisma.$transaction(async (tx) => {
    await tx.leadFollowUp.delete({ where: { id } });
    await syncNextFollowUp(existing.leadId, tx);
  });

  return { ok: true as const, leadId: existing.leadId };
}

export type FollowUpRecord = {
  id: string;
  leadId: string;
  dueAt: Date;
  type: string;
  typeLabel: string;
  title: string;
  note: string | null;
  status: string;
  completedAt: Date | null;
  outcome: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
  createdByName: string | null;
  createdAt: Date;
};

const FOLLOW_UP_SELECT = {
  id: true,
  leadId: true,
  dueAt: true,
  type: true,
  title: true,
  note: true,
  status: true,
  completedAt: true,
  outcome: true,
  assignedToId: true,
  assignedTo: { select: { name: true } },
  createdBy: { select: { name: true } },
  createdAt: true,
} satisfies Prisma.LeadFollowUpSelect;

function toRecord(
  row: Prisma.LeadFollowUpGetPayload<{ select: typeof FOLLOW_UP_SELECT }>,
): FollowUpRecord {
  return {
    id: row.id,
    leadId: row.leadId,
    dueAt: row.dueAt,
    type: row.type,
    typeLabel: followUpTypeLabel(row.type),
    title: row.title,
    note: row.note,
    status: row.status,
    completedAt: row.completedAt,
    outcome: row.outcome,
    assignedToId: row.assignedToId,
    assignedToName: row.assignedTo?.name ?? null,
    createdByName: row.createdBy?.name ?? null,
    createdAt: row.createdAt,
  };
}

/** Every follow-up on a lead — pending first, then the closed ones. */
export async function leadFollowUps(leadId: string, limit = 50): Promise<FollowUpRecord[]> {
  const rows = await prisma.leadFollowUp.findMany({
    where: { leadId },
    select: FOLLOW_UP_SELECT,
    orderBy: [{ status: "asc" }, { dueAt: "asc" }],
    take: Math.min(Math.max(limit, 1), 200),
  });
  return rows.map(toRecord);
}

/**
 * Pending follow-ups due on or before `before`, for one person or everyone.
 *
 * Skips tasks on leads that have since closed: winning a deal should not leave
 * its reminders nagging in the queue. The caller is responsible for scoping —
 * pass `assignedToId` for a restricted role.
 */
export async function dueFollowUps(options: {
  before: Date;
  assignedToId?: string | null;
  limit?: number;
}): Promise<FollowUpRecord[]> {
  const rows = await prisma.leadFollowUp.findMany({
    where: {
      status: "PENDING",
      dueAt: { lte: options.before },
      lead: { status: { notIn: [...CLOSED_STATUSES] } },
      ...(options.assignedToId ? { assignedToId: options.assignedToId } : {}),
    },
    select: FOLLOW_UP_SELECT,
    orderBy: { dueAt: "asc" },
    take: Math.min(Math.max(options.limit ?? 50, 1), 500),
  });
  return rows.map(toRecord);
}

/**
 * Close every pending follow-up on a lead, with a reason.
 *
 * Called when a lead is won, lost or marked junk — the work is over, and a
 * queue full of reminders for closed leads is a queue people stop reading.
 */
export async function closeFollowUpsForLead(
  leadId: string,
  reason: string,
  tx: Prisma.TransactionClient = prisma,
): Promise<number> {
  const result = await tx.leadFollowUp.updateMany({
    where: { leadId, status: "PENDING" },
    data: { status: "CANCELLED", completedAt: new Date(), outcome: reason.slice(0, 2000) },
  });
  if (result.count > 0) {
    logger.info("followup.closed_with_lead", { leadId, count: result.count, reason });
  }
  await syncNextFollowUp(leadId, tx);
  return result.count;
}
