import "server-only";
import { prisma } from "@/lib/db";
import { toNumber } from "@/lib/utils";
import { conversionRate } from "@/lib/crm";
import type { DashboardQuery } from "@/lib/validation";
import type { Prisma } from "@prisma/client";

/**
 * Business metrics for the admin dashboard.
 *
 * Money is always read from booking and payment rows the server wrote — a
 * number a browser once submitted never reaches a total here. Aggregation is
 * pushed into the database (`aggregate` / `groupBy`) so a growing business
 * does not turn the dashboard into a full table scan in JavaScript.
 */

export type DateRange = { from: Date; to: Date; label: string; key: string };

const DAY = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Turn the dashboard's date filter into a concrete range. */
export function resolveRange(query: DashboardQuery): DateRange {
  const now = new Date();

  switch (query.range) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now), label: "Today", key: "today" };

    case "yesterday": {
      const yesterday = new Date(now.getTime() - DAY);
      return {
        from: startOfDay(yesterday),
        to: endOfDay(yesterday),
        label: "Yesterday",
        key: "yesterday",
      };
    }

    case "7d":
      return {
        from: startOfDay(new Date(now.getTime() - 6 * DAY)),
        to: endOfDay(now),
        label: "Last 7 days",
        key: "7d",
      };

    case "month":
      return {
        from: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: endOfDay(now),
        label: "This month",
        key: "month",
      };

    case "last_month": {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        from: startOfDay(first),
        to: endOfDay(last),
        label: "Last month",
        key: "last_month",
      };
    }

    case "90d":
      return {
        from: startOfDay(new Date(now.getTime() - 89 * DAY)),
        to: endOfDay(now),
        label: "Last 90 days",
        key: "90d",
      };

    case "year":
      return {
        from: startOfDay(new Date(now.getFullYear(), 0, 1)),
        to: endOfDay(now),
        label: "This year",
        key: "year",
      };

    case "all":
      return { from: new Date(2000, 0, 1), to: endOfDay(now), label: "All time", key: "all" };

    case "custom": {
      const from = query.from ? new Date(`${query.from}T00:00:00`) : null;
      const to = query.to ? new Date(`${query.to}T23:59:59.999`) : null;
      // An unusable custom range falls back to the default rather than
      // producing a query with NaN boundaries.
      if (!from || !to || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
        return resolveRange({ ...query, range: "30d" });
      }
      return {
        from,
        to,
        label: `${query.from} to ${query.to}`,
        key: "custom",
      };
    }

    case "30d":
    default:
      return {
        from: startOfDay(new Date(now.getTime() - 29 * DAY)),
        to: endOfDay(now),
        label: "Last 30 days",
        key: "30d",
      };
  }
}

export type DashboardMetrics = {
  range: DateRange;
  leads: {
    total: number;
    new: number;
    qualified: number;
    won: number;
    lost: number;
    open: number;
    overdueFollowUps: number;
  };
  bookings: {
    total: number;
    confirmed: number;
    cancelled: number;
    upcomingTrips: number;
  };
  revenue: {
    /** Everything booked in the period, whether or not it has been paid. */
    grossBookingValue: number;
    /** Money actually received against those bookings. */
    paid: number;
    /** Booked but not yet received. */
    pending: number;
    refunded: number;
    averageBookingValue: number;
    currency: string;
  };
  conversion: {
    rate: number;
    leads: number;
    bookings: number;
  };
};

/** Bookings whose payment has settled — the only ones counted as revenue. */
const PAID_STATUSES = ["PAID", "PARTIALLY_REFUNDED"];

export async function getDashboardMetrics(query: DashboardQuery): Promise<DashboardMetrics> {
  const range = resolveRange(query);
  const period: Prisma.DateTimeFilter = { gte: range.from, lte: range.to };
  const now = new Date();

  const [
    leadsByStatus,
    leadsTotal,
    overdueFollowUps,
    bookingsByStatus,
    bookingTotals,
    paidTotals,
    refundedTotals,
    upcomingTrips,
    currencyRow,
  ] = await Promise.all([
    prisma.lead.groupBy({ by: ["status"], where: { createdAt: period }, _count: { _all: true } }),
    prisma.lead.count({ where: { createdAt: period } }),
    prisma.lead.count({
      where: {
        nextFollowUpAt: { not: null, lt: startOfDay(now) },
        status: { notIn: ["CONVERTED", "LOST"] },
      },
    }),
    prisma.booking.groupBy({
      by: ["status"],
      where: { createdAt: period },
      _count: { _all: true },
    }),
    prisma.booking.aggregate({
      where: { createdAt: period, status: { not: "CANCELLED" } },
      _sum: { totalAmount: true },
      _count: { _all: true },
    }),
    prisma.booking.aggregate({
      where: { createdAt: period, paymentStatus: { in: PAID_STATUSES } },
      _sum: { totalAmount: true, advanceAmount: true },
    }),
    prisma.booking.aggregate({
      where: { createdAt: period, paymentStatus: "REFUNDED" },
      _sum: { totalAmount: true },
    }),
    // Trips that have not departed yet — an operations number, not a
    // period one, so it deliberately ignores the date filter.
    prisma.booking.count({
      where: { travelDate: { gte: now }, status: { in: ["CONFIRMED", "IN_PROGRESS"] } },
    }),
    prisma.booking.findFirst({
      where: { createdAt: period },
      select: { currency: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const leadCount = (status: string) =>
    leadsByStatus.find((row) => row.status === status)?._count._all ?? 0;
  const bookingCount = (status: string) =>
    bookingsByStatus.find((row) => row.status === status)?._count._all ?? 0;

  const won = leadCount("CONVERTED");
  const lost = leadCount("LOST");

  const grossBookingValue = toNumber(bookingTotals._sum.totalAmount);
  const paid = toNumber(paidTotals._sum.totalAmount);
  const refunded = toNumber(refundedTotals._sum.totalAmount);
  const bookingsInPeriod = bookingTotals._count._all;

  return {
    range,
    leads: {
      total: leadsTotal,
      new: leadCount("NEW"),
      qualified: leadCount("QUALIFIED") + leadCount("PROPOSAL_SENT"),
      won,
      lost,
      open: leadsTotal - won - lost,
      overdueFollowUps,
    },
    bookings: {
      total: bookingsInPeriod,
      confirmed: bookingCount("CONFIRMED") + bookingCount("IN_PROGRESS") + bookingCount("COMPLETED"),
      cancelled: bookingCount("CANCELLED"),
      upcomingTrips,
    },
    revenue: {
      grossBookingValue,
      paid,
      pending: Math.max(0, grossBookingValue - paid),
      refunded,
      averageBookingValue: bookingsInPeriod > 0 ? Math.round(grossBookingValue / bookingsInPeriod) : 0,
      currency: currencyRow?.currency ?? "INR",
    },
    conversion: {
      rate: conversionRate(leadsTotal, bookingsInPeriod),
      leads: leadsTotal,
      bookings: bookingsInPeriod,
    },
  };
}

export type TrendPoint = { label: string; date: string; leads: number; bookings: number; revenue: number };

/**
 * Daily (or monthly, for long ranges) trend series.
 *
 * Only the two date columns and the amount are selected, and the buckets are
 * filled in memory — one pass over two small projections rather than a query
 * per day.
 */
export async function getTrend(range: DateRange): Promise<TrendPoint[]> {
  const spanDays = Math.ceil((range.to.getTime() - range.from.getTime()) / DAY) + 1;
  const byMonth = spanDays > 92;

  const [leads, bookings] = await Promise.all([
    prisma.lead.findMany({
      where: { createdAt: { gte: range.from, lte: range.to } },
      select: { createdAt: true },
    }),
    prisma.booking.findMany({
      where: { createdAt: { gte: range.from, lte: range.to }, status: { not: "CANCELLED" } },
      select: { createdAt: true, totalAmount: true },
    }),
  ]);

  const keyFor = (date: Date) =>
    byMonth
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
      : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

  const buckets = new Map<string, TrendPoint>();

  // Seed every bucket so gaps render as zero rather than disappearing.
  const cursor = new Date(range.from);
  while (cursor <= range.to) {
    const key = keyFor(cursor);
    if (!buckets.has(key)) {
      buckets.set(key, {
        label: byMonth
          ? cursor.toLocaleDateString("en-IN", { month: "short", year: "2-digit" })
          : cursor.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        date: key,
        leads: 0,
        bookings: 0,
        revenue: 0,
      });
    }
    if (byMonth) cursor.setMonth(cursor.getMonth() + 1);
    else cursor.setDate(cursor.getDate() + 1);
  }

  for (const lead of leads) {
    const bucket = buckets.get(keyFor(lead.createdAt));
    if (bucket) bucket.leads += 1;
  }
  for (const booking of bookings) {
    const bucket = buckets.get(keyFor(booking.createdAt));
    if (bucket) {
      bucket.bookings += 1;
      bucket.revenue += toNumber(booking.totalAmount);
    }
  }

  return [...buckets.values()];
}

export type SourceRow = { source: string; leads: number; bookings: number; revenue: number };

/** Where leads and bookings came from, in one pass per table. */
export async function getSourceBreakdown(range: DateRange): Promise<SourceRow[]> {
  const period = { gte: range.from, lte: range.to };

  const [leadRows, bookingRows] = await Promise.all([
    prisma.lead.groupBy({ by: ["source"], where: { createdAt: period }, _count: { _all: true } }),
    prisma.booking.groupBy({
      by: ["source"],
      where: { createdAt: period, status: { not: "CANCELLED" } },
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
  ]);

  const map = new Map<string, SourceRow>();
  for (const row of leadRows) {
    map.set(row.source, { source: row.source, leads: row._count._all, bookings: 0, revenue: 0 });
  }
  for (const row of bookingRows) {
    const existing = map.get(row.source) ?? { source: row.source, leads: 0, bookings: 0, revenue: 0 };
    existing.bookings = row._count._all;
    existing.revenue = toNumber(row._sum.totalAmount);
    map.set(row.source, existing);
  }

  return [...map.values()].sort((a, b) => b.leads + b.bookings - (a.leads + a.bookings));
}

export type TopPackageRow = {
  id: string;
  name: string;
  destination: string;
  bookings: number;
  revenue: number;
};

/** Packages ranked by revenue in the period. */
export async function getTopPackages(range: DateRange, limit = 6): Promise<TopPackageRow[]> {
  const grouped = await prisma.booking.groupBy({
    by: ["packageId"],
    where: { createdAt: { gte: range.from, lte: range.to }, status: { not: "CANCELLED" } },
    _count: { _all: true },
    _sum: { totalAmount: true },
    orderBy: { _sum: { totalAmount: "desc" } },
    take: limit,
  });
  if (grouped.length === 0) return [];

  const packages = await prisma.travelPackage.findMany({
    where: { id: { in: grouped.map((row) => row.packageId) } },
    select: { id: true, name: true, destination: { select: { name: true } } },
  });
  const byId = new Map(packages.map((pkg) => [pkg.id, pkg]));

  return grouped.map((row) => ({
    id: row.packageId,
    name: byId.get(row.packageId)?.name ?? "Deleted package",
    destination: byId.get(row.packageId)?.destination?.name ?? "—",
    bookings: row._count._all,
    revenue: toNumber(row._sum.totalAmount),
  }));
}

export type TopDestinationRow = {
  id: string;
  name: string;
  leads: number;
  bookings: number;
  revenue: number;
};

/**
 * Destinations ranked by revenue, with the leads that mentioned them.
 *
 * Leads store a destination as free text (visitors type it), so they are
 * matched by name rather than by id — which is why the lead count is a
 * best-effort figure and is labelled as such in the UI.
 */
export async function getTopDestinations(range: DateRange, limit = 6): Promise<TopDestinationRow[]> {
  const period = { gte: range.from, lte: range.to };

  const bookingRows = await prisma.booking.findMany({
    where: { createdAt: period, status: { not: "CANCELLED" } },
    select: {
      totalAmount: true,
      package: { select: { destination: { select: { id: true, name: true } } } },
    },
  });

  const byDestination = new Map<string, TopDestinationRow>();
  for (const booking of bookingRows) {
    const destination = booking.package?.destination;
    if (!destination) continue;
    const row =
      byDestination.get(destination.id) ??
      { id: destination.id, name: destination.name, leads: 0, bookings: 0, revenue: 0 };
    row.bookings += 1;
    row.revenue += toNumber(booking.totalAmount);
    byDestination.set(destination.id, row);
  }

  const leadRows = await prisma.lead.groupBy({
    by: ["destination"],
    where: { createdAt: period, destination: { not: null } },
    _count: { _all: true },
  });

  const leadsByName = new Map<string, number>();
  for (const row of leadRows) {
    if (!row.destination) continue;
    const key = row.destination.trim().toLowerCase();
    leadsByName.set(key, (leadsByName.get(key) ?? 0) + row._count._all);
  }

  // Include destinations that only produced enquiries, not just bookings.
  const named = await prisma.destination.findMany({
    select: { id: true, name: true },
  });
  for (const destination of named) {
    const leads = leadsByName.get(destination.name.trim().toLowerCase()) ?? 0;
    if (leads === 0) continue;
    const row =
      byDestination.get(destination.id) ??
      { id: destination.id, name: destination.name, leads: 0, bookings: 0, revenue: 0 };
    row.leads = leads;
    byDestination.set(destination.id, row);
  }

  return [...byDestination.values()]
    .sort((a, b) => b.revenue - a.revenue || b.leads - a.leads)
    .slice(0, limit);
}

export type FunnelStage = { stage: string; count: number };

/** Lead pipeline as a funnel, for the dashboard chart. */
export async function getConversionFunnel(range: DateRange): Promise<FunnelStage[]> {
  const period = { gte: range.from, lte: range.to };

  const [rows, bookings] = await Promise.all([
    prisma.lead.groupBy({ by: ["status"], where: { createdAt: period }, _count: { _all: true } }),
    prisma.booking.count({ where: { createdAt: period, status: { not: "CANCELLED" } } }),
  ]);

  const count = (status: string) => rows.find((row) => row.status === status)?._count._all ?? 0;
  const total = rows.reduce((sum, row) => sum + row._count._all, 0);

  // Each stage counts everything that reached it or beyond, which is what
  // makes a funnel read as a funnel.
  const contacted = total - count("NEW");
  const qualified = count("QUALIFIED") + count("PROPOSAL_SENT") + count("FOLLOW_UP") + count("CONVERTED");
  const proposed = count("PROPOSAL_SENT") + count("CONVERTED");

  return [
    { stage: "Enquiries", count: total },
    { stage: "Contacted", count: Math.max(0, contacted) },
    { stage: "Qualified", count: qualified },
    { stage: "Proposal sent", count: proposed },
    { stage: "Won", count: count("CONVERTED") },
    { stage: "Bookings", count: bookings },
  ];
}

/* ───────────────────── period comparison ───────────────────── */

export type PeriodComparison = {
  /** The equivalent window immediately before the selected one. */
  previous: DateRange;
  /** Percentage change, or null when there is nothing to compare against. */
  leads: number | null;
  bookings: number | null;
  revenue: number | null;
  paid: number | null;
  conversion: number | null;
  /** Whether a comparison makes sense at all for this range. */
  comparable: boolean;
  /** "vs previous 30 days" — the phrase shown under each KPI. */
  label: string;
};

/**
 * Percentage change between two values.
 *
 * Returns null rather than 0 or Infinity when the previous period was empty:
 * "up ∞%" from a single lead is noise, and showing "0%" would claim the
 * business was flat when it actually started from nothing.
 */
function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

/** The window of the same length immediately before `range`. */
export function previousRange(range: DateRange): DateRange {
  const span = range.to.getTime() - range.from.getTime();
  const to = new Date(range.from.getTime() - 1);
  const from = new Date(to.getTime() - span);
  return { from, to, label: `Previous ${range.label.toLowerCase()}`, key: `${range.key}-previous` };
}

/**
 * Compare the selected period against the one before it.
 *
 * "All time" has nothing before it, so it reports `comparable: false` and the
 * dashboard shows the figures without a delta rather than inventing one.
 */
export async function getComparison(range: DateRange): Promise<PeriodComparison> {
  const previous = previousRange(range);
  const emptyLabel = `vs ${range.label.toLowerCase().replace(/^last /, "previous ").replace(/^this /, "previous ")}`;

  if (range.key === "all") {
    return {
      previous,
      leads: null,
      bookings: null,
      revenue: null,
      paid: null,
      conversion: null,
      comparable: false,
      label: "all time",
    };
  }

  const window = { gte: previous.from, lte: previous.to };
  const current = { gte: range.from, lte: range.to };

  const [
    previousLeads,
    previousBookings,
    previousRevenue,
    previousPaid,
    currentLeads,
    currentBookings,
    currentRevenue,
    currentPaid,
  ] = await Promise.all([
    prisma.lead.count({ where: { createdAt: window } }),
    prisma.booking.count({ where: { createdAt: window, status: { not: "CANCELLED" } } }),
    prisma.booking.aggregate({
      where: { createdAt: window, status: { not: "CANCELLED" } },
      _sum: { totalAmount: true },
    }),
    prisma.booking.aggregate({
      where: { createdAt: window, paymentStatus: { in: PAID_STATUSES } },
      _sum: { totalAmount: true },
    }),
    prisma.lead.count({ where: { createdAt: current } }),
    prisma.booking.count({ where: { createdAt: current, status: { not: "CANCELLED" } } }),
    prisma.booking.aggregate({
      where: { createdAt: current, status: { not: "CANCELLED" } },
      _sum: { totalAmount: true },
    }),
    prisma.booking.aggregate({
      where: { createdAt: current, paymentStatus: { in: PAID_STATUSES } },
      _sum: { totalAmount: true },
    }),
  ]);

  const rate = (bookings: number, leads: number) => (leads === 0 ? 0 : (bookings / leads) * 100);

  return {
    previous,
    leads: percentChange(currentLeads, previousLeads),
    bookings: percentChange(currentBookings, previousBookings),
    revenue: percentChange(
      toNumber(currentRevenue._sum.totalAmount),
      toNumber(previousRevenue._sum.totalAmount),
    ),
    paid: percentChange(toNumber(currentPaid._sum.totalAmount), toNumber(previousPaid._sum.totalAmount)),
    conversion: percentChange(
      rate(currentBookings, currentLeads),
      rate(previousBookings, previousLeads),
    ),
    comparable: true,
    label: emptyLabel,
  };
}

export type BookingStatusRow = { status: string; count: number; percent: number };

/** Booking mix for the period, as counts and shares. */
export async function getBookingStatusBreakdown(range: DateRange): Promise<BookingStatusRow[]> {
  const rows = await prisma.booking.groupBy({
    by: ["status"],
    where: { createdAt: { gte: range.from, lte: range.to } },
    _count: { _all: true },
  });

  const total = rows.reduce((sum, row) => sum + row._count._all, 0);

  return rows
    .map((row) => ({
      status: row.status,
      count: row._count._all,
      percent: total === 0 ? 0 : (row._count._all / total) * 100,
    }))
    .sort((a, b) => b.count - a.count);
}

export type LeadStageRow = { status: string; count: number; percent: number };

/** Lead pipeline for the period, as counts and shares. */
export async function getLeadStageBreakdown(range: DateRange): Promise<LeadStageRow[]> {
  const rows = await prisma.lead.groupBy({
    by: ["status"],
    where: { createdAt: { gte: range.from, lte: range.to } },
    _count: { _all: true },
  });

  const total = rows.reduce((sum, row) => sum + row._count._all, 0);

  return rows
    .map((row) => ({
      status: row.status,
      count: row._count._all,
      percent: total === 0 ? 0 : (row._count._all / total) * 100,
    }))
    .sort((a, b) => b.count - a.count);
}
