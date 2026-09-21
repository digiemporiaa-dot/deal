import "server-only";
import { prisma } from "@/lib/db";
import { isLeadOwnerOnly } from "@/lib/permissions";
import { CLOSED_STATUSES } from "@/lib/crm";
import type { AdminActor } from "@/lib/guard";
import type { LeadQuery } from "@/lib/validation";
import type { Prisma } from "@prisma/client";

/**
 * CRM queries.
 *
 * Every filter arrives from the URL, so the query is built from a validated
 * `LeadQuery` and the owner scope is applied last — a role restricted to its
 * own pipeline cannot widen the result set by editing the query string.
 */

export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Parse a YYYY-MM-DD filter into a day boundary; invalid input is ignored. */
function dayBoundary(value: string | undefined, end: boolean): Date | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T${end ? "23:59:59.999" : "00:00:00"}`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function buildLeadWhere(query: LeadQuery, actor: AdminActor | null): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = {};
  const and: Prisma.LeadWhereInput[] = [];

  if (query.q?.trim()) {
    const q = query.q.trim();
    // Case-insensitive because PostgreSQL `contains` is not.
    and.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
        { email: { contains: q, mode: "insensitive" } },
        { whatsapp: { contains: q } },
        { destination: { contains: q, mode: "insensitive" } },
        { campaign: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  if (query.status) and.push({ status: query.status });
  if (query.source) and.push({ source: query.source });
  if (query.priority) and.push({ priority: query.priority });
  if (query.destination) {
    and.push({ destination: { contains: query.destination, mode: "insensitive" } });
  }
  if (query.budget) and.push({ budget: { contains: query.budget, mode: "insensitive" } });
  if (query.band) and.push({ scoreBand: query.band });

  if (query.state === "open") and.push({ status: { notIn: [...CLOSED_STATUSES] } });
  else if (query.state === "closed") and.push({ status: { in: [...CLOSED_STATUSES] } });

  if (query.tag) {
    // Tags live JSON-encoded in a text column (the TravelPackage convention),
    // so the match is on the quoted token rather than the bare word — `"Goa"`
    // must not match a tag called "Goatrip". Case-insensitive because nobody
    // types a tag the same way twice.
    and.push({ tags: { contains: `"${query.tag}"`, mode: "insensitive" } });
  }

  const from = dayBoundary(query.from || undefined, false);
  const to = dayBoundary(query.to || undefined, true);
  if (from || to) {
    and.push({ createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } });
  }

  // Follow-up buckets.
  if (query.due === "overdue") {
    and.push({
      nextFollowUpAt: { not: null, lt: startOfToday() },
      status: { notIn: [...CLOSED_STATUSES] },
    });
  } else if (query.due === "today") {
    and.push({
      nextFollowUpAt: { gte: startOfToday(), lte: endOfToday() },
      status: { notIn: [...CLOSED_STATUSES] },
    });
  } else if (query.due === "upcoming") {
    and.push({ nextFollowUpAt: { gt: endOfToday() }, status: { notIn: [...CLOSED_STATUSES] } });
  } else if (query.due === "1") {
    // Legacy "due today or earlier" link, kept so saved URLs keep working.
    and.push({
      nextFollowUpAt: { not: null, lte: endOfToday() },
      status: { notIn: [...CLOSED_STATUSES] },
    });
  }

  // Ownership is applied last and is not negotiable.
  if (isLeadOwnerOnly(actor?.role)) {
    and.push({ assignedToId: actor?.id || "__no_such_user__" });
  } else if (query.owner === "me" && actor?.id) {
    and.push({ assignedToId: actor.id });
  } else if (query.owner === "none") {
    and.push({ assignedToId: null });
  } else if (query.owner) {
    and.push({ assignedToId: query.owner });
  }

  if (and.length > 0) where.AND = and;
  return where;
}

/** The scope a restricted role may ever see — used for the pipeline counters. */
export function leadScope(actor: AdminActor | null): Prisma.LeadWhereInput {
  return isLeadOwnerOnly(actor?.role)
    ? { assignedToId: actor?.id || "__no_such_user__" }
    : {};
}

function orderFor(sort: LeadQuery["sort"]): Prisma.LeadOrderByWithRelationInput[] {
  switch (sort) {
    case "newest":
      return [{ createdAt: "desc" }];
    case "oldest":
      return [{ createdAt: "asc" }];
    case "activity":
      return [{ lastActivityAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }];
    case "score":
      // Hottest first, and among equals the one nobody has touched recently.
      return [{ score: "desc" }, { nextFollowUpAt: { sort: "asc", nulls: "last" } }];
    case "followup":
    default:
      // Whatever needs chasing soonest, first.
      return [{ nextFollowUpAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }];
  }
}

export type LeadListRow = Prisma.LeadGetPayload<{
  select: {
    id: true;
    name: true;
    email: true;
    phone: true;
    whatsapp: true;
    destination: true;
    budget: true;
    source: true;
    campaign: true;
    status: true;
    priority: true;
    createdAt: true;
    nextFollowUpAt: true;
    lastActivityAt: true;
    assignedToId: true;
    score: true;
    scoreBand: true;
    tags: true;
    assignedTo: { select: { id: true; name: true } };
    _count: { select: { notes: true } };
  };
}>;

/** One page of leads plus the total, for the CRM list. */
export async function listLeads(query: LeadQuery, actor: AdminActor | null) {
  const where = buildLeadWhere(query, actor);
  const perPage = Math.min(Math.max(query.perPage, 1), 200);
  const page = Math.max(query.page, 1);

  const [rows, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: orderFor(query.sort),
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        whatsapp: true,
        destination: true,
        budget: true,
        source: true,
        campaign: true,
        status: true,
        priority: true,
        createdAt: true,
        nextFollowUpAt: true,
        lastActivityAt: true,
        assignedToId: true,
        score: true,
        scoreBand: true,
        tags: true,
        assignedTo: { select: { id: true, name: true } },
        _count: { select: { notes: true } },
      },
    }),
    prisma.lead.count({ where }),
  ]);

  return { rows, total, page, perPage, pageCount: Math.max(1, Math.ceil(total / perPage)) };
}

/** Counts for the pipeline strip above the list. */
export async function leadPipelineCounts(actor: AdminActor | null) {
  const scope = leadScope(actor);

  const [byStatus, overdue, dueToday, upcoming, unassigned, total] = await Promise.all([
    prisma.lead.groupBy({ by: ["status"], where: scope, _count: { _all: true } }),
    prisma.lead.count({
      where: {
        ...scope,
        nextFollowUpAt: { not: null, lt: startOfToday() },
        status: { notIn: [...CLOSED_STATUSES] },
      },
    }),
    prisma.lead.count({
      where: {
        ...scope,
        nextFollowUpAt: { gte: startOfToday(), lte: endOfToday() },
        status: { notIn: [...CLOSED_STATUSES] },
      },
    }),
    prisma.lead.count({
      where: {
        ...scope,
        nextFollowUpAt: { gt: endOfToday() },
        status: { notIn: [...CLOSED_STATUSES] },
      },
    }),
    prisma.lead.count({ where: { ...scope, assignedToId: null } }),
    prisma.lead.count({ where: scope }),
  ]);

  const statusCount = (status: string) =>
    byStatus.find((row) => row.status === status)?._count._all ?? 0;

  return { statusCount, overdue, dueToday, upcoming, unassigned, total };
}

/** Distinct sources present in the data, so the filter only offers real values. */
export async function leadSourceOptions(actor: AdminActor | null): Promise<string[]> {
  const rows = await prisma.lead.groupBy({
    by: ["source"],
    where: leadScope(actor),
    _count: { _all: true },
    orderBy: { _count: { source: "desc" } },
    take: 20,
  });
  return rows.map((row) => row.source);
}

/* ───────────────────── dashboard widgets ───────────────────── */

export type FollowUpRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  destination: string | null;
  status: string;
  priority: string;
  nextFollowUpAt: Date;
  assignedToName: string | null;
};

/**
 * Follow-ups the signed-in user should act on, split by urgency.
 *
 * Scoped like every other lead query: an agent sees their own work, a manager
 * sees the team's. The three buckets come from one query rather than three,
 * because they partition the same small set.
 */
export async function followUpQueue(actor: AdminActor | null, limit = 12) {
  const scope = leadScope(actor);
  const today = startOfToday();
  const tomorrow = endOfToday();

  const rows = await prisma.lead.findMany({
    where: {
      ...scope,
      nextFollowUpAt: { not: null, lte: new Date(tomorrow.getTime() + 7 * 24 * 60 * 60 * 1000) },
      status: { notIn: [...CLOSED_STATUSES] },
    },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      destination: true,
      status: true,
      priority: true,
      nextFollowUpAt: true,
      assignedTo: { select: { name: true } },
    },
    orderBy: { nextFollowUpAt: "asc" },
    take: limit * 3,
  });

  const mapped: FollowUpRow[] = rows
    .filter((row): row is typeof row & { nextFollowUpAt: Date } => row.nextFollowUpAt !== null)
    .map((row) => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      email: row.email,
      destination: row.destination,
      status: row.status,
      priority: row.priority,
      nextFollowUpAt: row.nextFollowUpAt,
      assignedToName: row.assignedTo?.name ?? null,
    }));

  return {
    overdue: mapped.filter((row) => row.nextFollowUpAt < today).slice(0, limit),
    today: mapped
      .filter((row) => row.nextFollowUpAt >= today && row.nextFollowUpAt <= tomorrow)
      .slice(0, limit),
    upcoming: mapped.filter((row) => row.nextFollowUpAt > tomorrow).slice(0, limit),
  };
}

export type RecentLeadRow = {
  id: string;
  name: string;
  contact: string;
  destination: string | null;
  status: string;
  createdAt: Date;
  assignedToName: string | null;
};

/** The newest enquiries, for the dashboard card. */
export async function recentLeads(actor: AdminActor | null, limit = 6): Promise<RecentLeadRow[]> {
  const rows = await prisma.lead.findMany({
    where: leadScope(actor),
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      destination: true,
      status: true,
      createdAt: true,
      assignedTo: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    contact: row.email || row.phone,
    destination: row.destination,
    status: row.status,
    createdAt: row.createdAt,
    assignedToName: row.assignedTo?.name ?? null,
  }));
}
