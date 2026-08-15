import "server-only";
import { prisma } from "@/lib/db";

export type Period = { from: Date; to: Date; label: string; key: string };

/** Named date ranges used by the reports filter. */
export function resolvePeriod(key?: string): Period {
  const now = new Date();
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);

  switch (key) {
    case "7d":
      from.setDate(from.getDate() - 6);
      return { from, to, label: "Last 7 days", key: "7d" };
    case "90d":
      from.setDate(from.getDate() - 89);
      return { from, to, label: "Last 90 days", key: "90d" };
    case "year":
      from.setMonth(0, 1);
      return { from, to, label: "This year", key: "year" };
    case "all":
      return { from: new Date(2000, 0, 1), to, label: "All time", key: "all" };
    case "30d":
    default:
      from.setDate(from.getDate() - 29);
      return { from, to, label: "Last 30 days", key: "30d" };
  }
}

export type StaffRow = {
  id: string;
  name: string;
  role: string;
  assigned: number;
  converted: number;
  lost: number;
  open: number;
  conversionRate: number;
  emailsSent: number;
  callsLogged: number;
  overdue: number;
};

export type MonthRow = { month: string; bookings: number; revenue: number; leads: number };

export type SourceRow = { source: string; total: number; converted: number; rate: number };

export type ReportData = {
  period: Period;
  totals: {
    leads: number;
    converted: number;
    lost: number;
    open: number;
    conversionRate: number;
    bookings: number;
    revenue: number;
    collected: number;
    outstanding: number;
    avgBookingValue: number;
    unassigned: number;
    overdue: number;
  };
  staff: StaffRow[];
  months: MonthRow[];
  sources: SourceRow[];
  statusCounts: { status: string; count: number }[];
  topPackages: { name: string; bookings: number; revenue: number }[];
};

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}

export async function buildReport(periodKey?: string): Promise<ReportData> {
  const period = resolvePeriod(periodKey);
  const range = { gte: period.from, lte: period.to };

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const [leads, bookings, users, notes, invoices] = await Promise.all([
    prisma.lead.findMany({
      where: { createdAt: range },
      select: {
        id: true,
        status: true,
        source: true,
        assignedToId: true,
        nextFollowUpAt: true,
        createdAt: true,
      },
    }),
    prisma.booking.findMany({
      where: { createdAt: range },
      select: {
        id: true,
        createdAt: true,
        totalAmount: true,
        paymentStatus: true,
        package: { select: { name: true } },
      },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
    prisma.leadNote.findMany({
      where: { createdAt: range, authorId: { not: null } },
      select: { authorId: true, type: true },
    }),
    prisma.salesDocument.findMany({
      where: { kind: "INVOICE", createdAt: range },
      select: { amountPaid: true, discount: true, taxPercent: true, items: { select: { quantity: true, unitPrice: true } } },
    }),
  ]);

  /* ---- lead totals ---- */
  const converted = leads.filter((l) => l.status === "CONVERTED").length;
  const lost = leads.filter((l) => l.status === "LOST").length;
  const open = leads.length - converted - lost;
  const unassigned = leads.filter((l) => !l.assignedToId).length;
  const overdue = leads.filter(
    (l) => l.nextFollowUpAt && l.nextFollowUpAt <= endOfToday && l.status !== "CONVERTED" && l.status !== "LOST",
  ).length;

  /* ---- revenue ---- */
  const revenue = bookings.reduce((s, b) => s + Number(b.totalAmount), 0);
  const collected = bookings
    .filter((b) => b.paymentStatus === "PAID")
    .reduce((s, b) => s + Number(b.totalAmount), 0);

  const invoiceTotal = invoices.reduce((sum, inv) => {
    const sub = inv.items.reduce((s, i) => s + i.quantity * Number(i.unitPrice), 0);
    const disc = Math.min(Number(inv.discount), sub);
    const taxable = sub - disc;
    return sum + taxable + Math.round((taxable * Number(inv.taxPercent)) / 100);
  }, 0);
  const invoicePaid = invoices.reduce((s, inv) => s + Number(inv.amountPaid), 0);

  /* ---- per staff ---- */
  const staff: StaffRow[] = users.map((u) => {
    const mine = leads.filter((l) => l.assignedToId === u.id);
    const won = mine.filter((l) => l.status === "CONVERTED").length;
    const drop = mine.filter((l) => l.status === "LOST").length;
    const myNotes = notes.filter((n) => n.authorId === u.id);
    const closed = won + drop;
    return {
      id: u.id,
      name: u.name,
      role: u.role,
      assigned: mine.length,
      converted: won,
      lost: drop,
      open: mine.length - closed,
      conversionRate: closed > 0 ? Math.round((won / closed) * 100) : 0,
      emailsSent: myNotes.filter((n) => n.type === "EMAIL").length,
      callsLogged: myNotes.filter((n) => n.type === "CALL").length,
      overdue: mine.filter(
        (l) => l.nextFollowUpAt && l.nextFollowUpAt <= endOfToday && l.status !== "CONVERTED" && l.status !== "LOST",
      ).length,
    };
  });
  staff.sort((a, b) => b.converted - a.converted || b.assigned - a.assigned);

  /* ---- month by month (last 12 months regardless of filter) ---- */
  const monthKeys: string[] = [];
  const cursor = new Date();
  cursor.setDate(1);
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(cursor);
    d.setMonth(d.getMonth() - i);
    monthKeys.push(monthKey(d));
  }
  const yearStart = new Date();
  yearStart.setMonth(yearStart.getMonth() - 11, 1);
  yearStart.setHours(0, 0, 0, 0);

  const [yearBookings, yearLeads] = await Promise.all([
    prisma.booking.findMany({
      where: { createdAt: { gte: yearStart } },
      select: { createdAt: true, totalAmount: true },
    }),
    prisma.lead.findMany({ where: { createdAt: { gte: yearStart } }, select: { createdAt: true } }),
  ]);

  const months: MonthRow[] = monthKeys.map((key) => {
    const mb = yearBookings.filter((b) => monthKey(b.createdAt) === key);
    return {
      month: monthLabel(key),
      bookings: mb.length,
      revenue: mb.reduce((s, b) => s + Number(b.totalAmount), 0),
      leads: yearLeads.filter((l) => monthKey(l.createdAt) === key).length,
    };
  });

  /* ---- lead sources ---- */
  const sourceMap = new Map<string, { total: number; converted: number }>();
  for (const l of leads) {
    const key = l.source || "website";
    const row = sourceMap.get(key) ?? { total: 0, converted: 0 };
    row.total += 1;
    if (l.status === "CONVERTED") row.converted += 1;
    sourceMap.set(key, row);
  }
  const sources: SourceRow[] = [...sourceMap.entries()]
    .map(([source, v]) => ({
      source,
      total: v.total,
      converted: v.converted,
      rate: v.total ? Math.round((v.converted / v.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  /* ---- status breakdown ---- */
  const statusOrder = ["NEW", "CONTACTED", "FOLLOW_UP", "QUALIFIED", "CONVERTED", "LOST"];
  const statusCounts = statusOrder.map((status) => ({
    status,
    count: leads.filter((l) => l.status === status).length,
  }));

  /* ---- top packages ---- */
  const pkgMap = new Map<string, { bookings: number; revenue: number }>();
  for (const b of bookings) {
    const name = b.package?.name ?? "Unknown package";
    const row = pkgMap.get(name) ?? { bookings: 0, revenue: 0 };
    row.bookings += 1;
    row.revenue += Number(b.totalAmount);
    pkgMap.set(name, row);
  }
  const topPackages = [...pkgMap.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);

  return {
    period,
    totals: {
      leads: leads.length,
      converted,
      lost,
      open,
      conversionRate: converted + lost > 0 ? Math.round((converted / (converted + lost)) * 100) : 0,
      bookings: bookings.length,
      revenue,
      collected: collected + invoicePaid,
      outstanding: Math.max(invoiceTotal - invoicePaid, 0),
      avgBookingValue: bookings.length ? Math.round(revenue / bookings.length) : 0,
      unassigned,
      overdue,
    },
    staff,
    months,
    sources,
    statusCounts,
    topPackages,
  };
}
