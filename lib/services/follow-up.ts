import "server-only";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  CLOSED_STATUSES,
  QUEUE_BUCKETS,
  BUCKET_LABELS,
  ESCALATION_DAYS,
  dayEdges,
  bucketFor,
  daysLate as daysLateFor,
  isEscalated,
  type QueueBucket,
} from "@/lib/crm";
import { isLeadOwnerOnly } from "@/lib/permissions";
import type { AdminActor } from "@/lib/guard";
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

// Re-exported so a caller needs one import for the whole follow-up
// vocabulary, even though the urgency rules live in the edge-safe domain
// module where they can be unit-tested.
export { QUEUE_BUCKETS, BUCKET_LABELS, ESCALATION_DAYS, type QueueBucket };

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

/* ───────────────────────── the queue ───────────────────────── */

/**
 * How overdue a follow-up has to be before it counts as escalated.
 *
 * Three working days: a task one day late is someone having a busy morning,
 * a task three days late is a lead quietly going cold. The number is here
 * rather than inlined because the queue page, the badge and the manager
 * digest all have to agree on it.
 */
export type QueueItem = FollowUpRecord & {
  bucket: QueueBucket;
  /** Whole days late; 0 when not overdue. */
  daysLate: number;
  escalated: boolean;
  leadName: string;
  leadPhone: string;
  leadEmail: string | null;
  leadStatus: string;
  leadScore: number;
  leadScoreBand: string;
  leadDestination: string | null;
};

const QUEUE_SELECT = {
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
  lead: {
    select: {
      name: true,
      phone: true,
      email: true,
      status: true,
      score: true,
      scoreBand: true,
      destination: true,
    },
  },
} satisfies Prisma.LeadFollowUpSelect;

export type QueueFilters = {
  /** A specific owner, "me", "none", or undefined for everyone in scope. */
  owner?: string;
  type?: string;
  bucket?: QueueBucket;
  /** Lead name, phone or email. */
  q?: string;
  limit?: number;
};

/**
 * Every pending follow-up the signed-in user should see, bucketed by urgency.
 *
 * This is the page that answers "what do I do next", which `Lead.nextFollowUpAt`
 * could never do properly: that column holds one date per lead, so a lead with
 * three things outstanding looked like a lead with one.
 *
 * Scoping is the same rule as everywhere else and is applied last: a role that
 * works only its own pipeline sees only tasks on its own leads, whatever the
 * query string says. Tasks on closed leads are excluded outright — winning a
 * deal should not leave its reminders nagging.
 */
export async function followUpQueue(
  actor: AdminActor | null,
  filters: QueueFilters = {},
): Promise<{ items: QueueItem[]; counts: Record<QueueBucket, number>; escalated: number }> {
  const now = new Date();
  const edges = dayEdges(now);

  const and: Prisma.LeadFollowUpWhereInput[] = [
    { status: "PENDING" },
    { lead: { status: { notIn: [...CLOSED_STATUSES] } } },
  ];

  if (filters.type) and.push({ type: filters.type });

  if (filters.q?.trim()) {
    const q = filters.q.trim();
    and.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { lead: { name: { contains: q, mode: "insensitive" } } },
        { lead: { phone: { contains: q } } },
        { lead: { email: { contains: q, mode: "insensitive" } } },
      ],
    });
  }

  // Ownership last, and not negotiable. A restricted role is pinned to the
  // leads assigned to it — not merely to tasks assigned to it, because an
  // unassigned task on their lead is still their work.
  if (isLeadOwnerOnly(actor?.role)) {
    and.push({ lead: { assignedToId: actor?.id || "__no_such_user__" } });
  } else if (filters.owner === "me" && actor?.id) {
    and.push({ assignedToId: actor.id });
  } else if (filters.owner === "none") {
    and.push({ assignedToId: null });
  } else if (filters.owner) {
    and.push({ assignedToId: filters.owner });
  }

  const rows = await prisma.leadFollowUp.findMany({
    where: { AND: and },
    select: QUEUE_SELECT,
    orderBy: { dueAt: "asc" },
    take: Math.min(Math.max(filters.limit ?? 300, 1), 1000),
  });

  const counts: Record<QueueBucket, number> = {
    overdue: 0,
    today: 0,
    tomorrow: 0,
    week: 0,
    later: 0,
  };
  let escalated = 0;

  const items: QueueItem[] = rows.map((row) => {
    const bucket = bucketFor(row.dueAt, edges);
    counts[bucket] += 1;

    const late = daysLateFor(row.dueAt, edges);
    const escalatedRow = isEscalated(row.dueAt, edges);
    if (escalatedRow) escalated += 1;

    return {
      ...toRecord(row),
      bucket,
      daysLate: late,
      escalated: escalatedRow,
      leadName: row.lead.name,
      leadPhone: row.lead.phone,
      leadEmail: row.lead.email,
      leadStatus: row.lead.status,
      leadScore: row.lead.score,
      leadScoreBand: row.lead.scoreBand,
      leadDestination: row.lead.destination,
    };
  });

  return {
    items: filters.bucket ? items.filter((item) => item.bucket === filters.bucket) : items,
    counts,
    escalated,
  };
}

/**
 * Pending follow-ups grouped by the person who owns them.
 *
 * Feeds the nightly digest. Only tasks that are due — today or earlier — are
 * returned, because a digest listing next month's work is a digest people
 * stop opening. Unassigned tasks have nobody to email and are left out; the
 * queue page surfaces them instead.
 */
export async function dueFollowUpsByOwner(now = new Date()) {
  const { endOfToday, startOfToday } = dayEdges(now);

  const rows = await prisma.leadFollowUp.findMany({
    where: {
      status: "PENDING",
      dueAt: { lte: endOfToday },
      assignedToId: { not: null },
      lead: { status: { notIn: [...CLOSED_STATUSES] } },
    },
    select: {
      id: true,
      dueAt: true,
      type: true,
      title: true,
      leadId: true,
      lead: { select: { name: true, destination: true } },
      assignedTo: { select: { id: true, name: true, email: true, isActive: true } },
    },
    orderBy: { dueAt: "asc" },
    take: 2000,
  });

  const byOwner = new Map<
    string,
    {
      id: string;
      name: string;
      email: string;
      overdue: typeof rows;
      today: typeof rows;
    }
  >();

  for (const row of rows) {
    const owner = row.assignedTo;
    if (!owner?.isActive || !owner.email) continue;

    const entry =
      byOwner.get(owner.id) ??
      { id: owner.id, name: owner.name, email: owner.email, overdue: [], today: [] };

    if (row.dueAt < startOfToday) entry.overdue.push(row);
    else entry.today.push(row);

    byOwner.set(owner.id, entry);
  }

  return [...byOwner.values()];
}

/**
 * Follow-ups that are badly overdue, whoever owns them.
 *
 * A task nobody has touched in three working days is not a busy morning any
 * more — it is a lead going cold with an owner who has stopped looking. This
 * is what the manager digest reports, so the escalation reaches someone who
 * can reassign it.
 */
export async function escalatedFollowUps(now = new Date(), limit = 100) {
  const edges = dayEdges(now);
  const cutoff = new Date(
    edges.startOfToday.getTime() - (ESCALATION_DAYS - 1) * 24 * 60 * 60 * 1000,
  );

  const rows = await prisma.leadFollowUp.findMany({
    where: {
      status: "PENDING",
      dueAt: { lt: cutoff },
      lead: { status: { notIn: [...CLOSED_STATUSES] } },
    },
    select: {
      id: true,
      dueAt: true,
      title: true,
      type: true,
      leadId: true,
      lead: { select: { name: true, destination: true, score: true } },
      assignedTo: { select: { name: true } },
    },
    orderBy: { dueAt: "asc" },
    take: limit,
  });

  return rows.map((row) => ({ ...row, daysLate: daysLateFor(row.dueAt, edges) }));
}
