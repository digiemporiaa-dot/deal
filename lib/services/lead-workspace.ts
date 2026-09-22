import "server-only";
import { prisma } from "@/lib/db";
import { isLeadOwnerOnly } from "@/lib/permissions";
import {
  LEAD_STATUSES,
  CLOSED_STATUSES,
  OPEN_STATUSES,
  parseTags,
  scoreLead,
  scoreInputFromLead,
  type LeadScore,
} from "@/lib/crm";
import { findDuplicateLeads, type DuplicateLead } from "@/lib/services/lead-dedupe";
import { leadFollowUps, type FollowUpRecord } from "@/lib/services/follow-up";
import { leadStageDurations } from "@/lib/services/lead-conversion";
import { buildLeadWhere, leadScope } from "@/lib/services/crm";
import type { AdminActor } from "@/lib/guard";
import type { LeadQuery } from "@/lib/validation";

/**
 * Everything one lead's workspace needs, in one place.
 *
 * The detail page used to assemble this itself with a single `include`, which
 * worked while a lead was contact details and a note list. It now also has
 * follow-up tasks, pipeline history, a score to explain and possible
 * duplicates — so the reads move here, behind the same ownership rule the
 * list uses, rather than growing a page component into a query layer.
 */

export type LeadWorkspace = NonNullable<Awaited<ReturnType<typeof leadWorkspace>>>;

export async function leadWorkspace(id: string, actor: AdminActor | null) {
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      notes: {
        orderBy: { createdAt: "desc" },
        include: { author: { select: { name: true } } },
        take: 200,
      },
      assignedTo: { select: { id: true, name: true } },
      customer: { select: { id: true, name: true, email: true, phone: true } },
      package: { select: { id: true, name: true, slug: true } },
      destinationRef: { select: { id: true, name: true } },
      _count: { select: { notes: true } },
    },
  });

  if (!lead) return null;

  // Ownership is re-read from the database, never taken from the request. A
  // role that works only its own pipeline cannot open a colleague's lead by
  // typing the id into the address bar.
  if (isLeadOwnerOnly(actor?.role) && lead.assignedToId !== actor?.id) return null;

  const [followUps, history, duplicates] = await Promise.all([
    leadFollowUps(id),
    leadStageDurations(id),
    findDuplicateLeads({ phone: lead.phone, email: lead.email, excludeLeadId: id, limit: 5 }),
  ]);

  // Recomputed for display rather than read from the column: the stored score
  // is what the list sorts on, but a lead sitting open for a week drifts, and
  // showing a number that disagrees with its own reasons is worse than
  // showing none.
  const score: LeadScore = scoreLead(scoreInputFromLead(lead, lead._count.notes));

  return {
    lead,
    tags: parseTags(lead.tags),
    score,
    followUps,
    history,
    duplicates: duplicates.leads,
    emailCount: lead.notes.filter((note) => note.type === "EMAIL").length,
    callCount: lead.notes.filter((note) => note.type === "CALL").length,
    lastTouch: lead.notes[0]?.createdAt ?? null,
  };
}

/* ───────────────────────── the board ───────────────────────── */

export type BoardCard = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  destination: string | null;
  budget: string | null;
  status: string;
  priority: string;
  score: number;
  scoreBand: string;
  tags: string[];
  nextFollowUpAt: string | null;
  overdue: boolean;
  assignedToId: string | null;
  assignedToName: string | null;
  activityCount: number;
  createdAt: string;
};

export type BoardColumn = {
  status: string;
  cards: BoardCard[];
  /** Total in this status, which can exceed the cards loaded. */
  total: number;
};

/**
 * How many cards a column loads.
 *
 * A pipeline column can hold thousands of leads and a board that tries to
 * render them all is a board nobody can scroll. Each column shows the most
 * urgent slice and reports its true total, so the number in the header is
 * never a lie about how much work there is.
 */
export const BOARD_COLUMN_LIMIT = 50;

/**
 * The pipeline as columns of cards.
 *
 * Reuses `buildLeadWhere`, so every filter on the list works identically here
 * and — more importantly — the ownership scope is the same one, applied in
 * the same place. A board with its own query would be a second chance to get
 * that wrong.
 *
 * Closed statuses are left out unless the filter explicitly asks for one:
 * nobody drags a lead across a column of two thousand won deals.
 */
export async function leadBoard(query: LeadQuery, actor: AdminActor | null) {
  const where = buildLeadWhere(query, actor);

  const statuses = query.status
    ? [query.status]
    : query.state === "closed"
      ? [...CLOSED_STATUSES]
      : [...OPEN_STATUSES];

  const [grouped, rows] = await Promise.all([
    prisma.lead.groupBy({ by: ["status"], where, _count: { _all: true } }),
    Promise.all(
      statuses.map((status) =>
        prisma.lead.findMany({
          where: { AND: [where, { status }] },
          orderBy: [{ score: "desc" }, { nextFollowUpAt: { sort: "asc", nulls: "last" } }],
          take: BOARD_COLUMN_LIMIT,
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            destination: true,
            budget: true,
            status: true,
            priority: true,
            score: true,
            scoreBand: true,
            tags: true,
            nextFollowUpAt: true,
            assignedToId: true,
            createdAt: true,
            assignedTo: { select: { name: true } },
            _count: { select: { notes: true } },
          },
        }),
      ),
    ),
  ]);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const columns: BoardColumn[] = statuses.map((status, index) => ({
    status,
    total: grouped.find((row) => row.status === status)?._count._all ?? 0,
    cards: rows[index].map((row) => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      email: row.email,
      destination: row.destination,
      budget: row.budget,
      status: row.status,
      priority: row.priority,
      score: row.score,
      scoreBand: row.scoreBand,
      tags: parseTags(row.tags),
      nextFollowUpAt: row.nextFollowUpAt?.toISOString() ?? null,
      overdue: Boolean(row.nextFollowUpAt && row.nextFollowUpAt < startOfToday),
      assignedToId: row.assignedToId,
      assignedToName: row.assignedTo?.name ?? null,
      activityCount: row._count.notes,
      createdAt: row.createdAt.toISOString(),
    })),
  }));

  return { columns, statuses };
}

/** How many leads sit in each score band — for the workspace filter chips. */
export async function leadBandCounts(actor: AdminActor | null) {
  const rows = await prisma.lead.groupBy({
    by: ["scoreBand"],
    where: { ...leadScope(actor), status: { notIn: [...CLOSED_STATUSES] } },
    _count: { _all: true },
  });
  const count = (band: string) => rows.find((row) => row.scoreBand === band)?._count._all ?? 0;
  return { hot: count("HOT"), warm: count("WARM"), cold: count("COLD") };
}

/**
 * Tags actually in use, most common first.
 *
 * Read from the leads rather than a fixed list, so the filter only ever
 * offers a tag that would return something. Tags live JSON-encoded in a text
 * column, so this counts them in memory — bounded by taking only the leads
 * that have any tags at all.
 */
export async function leadTagOptions(actor: AdminActor | null, limit = 30): Promise<string[]> {
  const rows = await prisma.lead.findMany({
    where: { ...leadScope(actor), NOT: { tags: "[]" } },
    select: { tags: true },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });

  const counts = new Map<string, { label: string; n: number }>();
  for (const row of rows) {
    for (const tag of parseTags(row.tags)) {
      const key = tag.toLowerCase();
      const entry = counts.get(key) ?? { label: tag, n: 0 };
      entry.n += 1;
      counts.set(key, entry);
    }
  }

  return [...counts.values()]
    .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label))
    .slice(0, limit)
    .map((entry) => entry.label);
}

/** The statuses a board shows, in pipeline order. */
export const BOARD_STATUSES = LEAD_STATUSES.filter(
  (status) => !(CLOSED_STATUSES as readonly string[]).includes(status),
);

export type { DuplicateLead, FollowUpRecord };
