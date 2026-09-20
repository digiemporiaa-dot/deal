import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { toNumber } from "@/lib/utils";
import type { BookingQuery, PaymentQuery, CustomerQuery } from "@/lib/validation";

/**
 * Bookings, payments and customers — server-side list queries.
 *
 * Every list here filters, sorts and pages in the database and selects only
 * the columns the table shows. The previous versions of these pages called
 * `findMany` with no `take`, which is fine with fifty bookings and a problem
 * with fifty thousand.
 */

const PAID_STATUSES = ["PAID", "PARTIALLY_REFUNDED"];

/* ───────────────────────── bookings ───────────────────────── */

function bookingWhere(query: BookingQuery): Prisma.BookingWhereInput {
  const where: Prisma.BookingWhereInput = {};
  const and: Prisma.BookingWhereInput[] = [];

  if (query.status) where.status = query.status;
  if (query.payment) where.paymentStatus = query.payment;

  if (query.q) {
    const contains = { contains: query.q, mode: "insensitive" as const };
    and.push({
      OR: [
        { bookingNumber: contains },
        { customer: { name: contains } },
        { customer: { email: contains } },
        { customer: { phone: contains } },
        { package: { name: contains } },
      ],
    });
  }

  if (query.destination) {
    and.push({ package: { destination: { slug: query.destination } } });
  }

  // "Upcoming" is about the trip, not about when it was booked.
  if (query.upcoming === "1") {
    and.push({ travelDate: { gte: new Date() }, status: { notIn: ["CANCELLED", "COMPLETED"] } });
  }

  if (query.from || query.to) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (query.from) createdAt.gte = new Date(`${query.from}T00:00:00`);
    if (query.to) createdAt.lte = new Date(`${query.to}T23:59:59.999`);
    and.push({ createdAt });
  }

  if (and.length > 0) where.AND = and;
  return where;
}

const BOOKING_ORDER: Record<BookingQuery["sort"], Prisma.BookingOrderByWithRelationInput> = {
  newest: { createdAt: "desc" },
  oldest: { createdAt: "asc" },
  travel: { travelDate: "asc" },
  amount: { totalAmount: "desc" },
};

export async function listBookings(query: BookingQuery) {
  const where = bookingWhere(query);
  const skip = (query.page - 1) * query.perPage;

  const [rows, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      orderBy: BOOKING_ORDER[query.sort],
      skip,
      take: query.perPage,
      select: {
        id: true,
        bookingNumber: true,
        createdAt: true,
        travelDate: true,
        adults: true,
        children: true,
        totalAmount: true,
        advanceAmount: true,
        remainingAmount: true,
        currency: true,
        status: true,
        paymentStatus: true,
        source: true,
        customer: { select: { id: true, name: true, email: true, phone: true } },
        package: {
          select: { id: true, name: true, destination: { select: { name: true } } },
        },
      },
    }),
    prisma.booking.count({ where }),
  ]);

  return {
    rows,
    total,
    page: query.page,
    pageCount: Math.max(1, Math.ceil(total / query.perPage)),
  };
}

/** Headline figures above the bookings table, for the same filtered set. */
export async function bookingSummary(query: BookingQuery) {
  const where = bookingWhere(query);

  const [total, confirmed, cancelled, upcoming, value] = await Promise.all([
    prisma.booking.count({ where }),
    prisma.booking.count({ where: { ...where, status: { in: ["CONFIRMED", "IN_PROGRESS"] } } }),
    prisma.booking.count({ where: { ...where, status: "CANCELLED" } }),
    prisma.booking.count({
      where: { ...where, travelDate: { gte: new Date() }, status: { notIn: ["CANCELLED", "COMPLETED"] } },
    }),
    prisma.booking.aggregate({
      where: { ...where, status: { not: "CANCELLED" } },
      _sum: { totalAmount: true },
    }),
  ]);

  return {
    total,
    confirmed,
    cancelled,
    upcoming,
    value: toNumber(value._sum.totalAmount),
  };
}

/* ───────────────────────── payments ───────────────────────── */

function paymentWhere(query: PaymentQuery): Prisma.PaymentWhereInput {
  const where: Prisma.PaymentWhereInput = {};
  const and: Prisma.PaymentWhereInput[] = [];

  if (query.status) where.status = query.status;
  if (query.method) where.paymentMethod = query.method;

  if (query.q) {
    const contains = { contains: query.q, mode: "insensitive" as const };
    and.push({
      OR: [
        { razorpayPaymentId: contains },
        { razorpayOrderId: contains },
        { booking: { bookingNumber: contains } },
        { booking: { customer: { name: contains } } },
      ],
    });
  }

  if (query.from || query.to) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (query.from) createdAt.gte = new Date(`${query.from}T00:00:00`);
    if (query.to) createdAt.lte = new Date(`${query.to}T23:59:59.999`);
    and.push({ createdAt });
  }

  if (and.length > 0) where.AND = and;
  return where;
}

export async function listPayments(query: PaymentQuery) {
  const where = paymentWhere(query);
  const skip = (query.page - 1) * query.perPage;

  const [rows, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: query.perPage,
      select: {
        id: true,
        razorpayPaymentId: true,
        razorpayOrderId: true,
        amount: true,
        currency: true,
        status: true,
        paymentMethod: true,
        createdAt: true,
        booking: {
          select: {
            id: true,
            bookingNumber: true,
            customer: { select: { name: true } },
            package: { select: { name: true } },
          },
        },
      },
    }),
    prisma.payment.count({ where }),
  ]);

  return {
    rows,
    total,
    page: query.page,
    pageCount: Math.max(1, Math.ceil(total / query.perPage)),
  };
}

/**
 * Money in, money outstanding, money returned.
 *
 * Collected comes from settled payment rows; outstanding comes from the
 * bookings themselves, because a booking with nothing paid has no payment row
 * to count. Reading both from one table would undercount one of them.
 */
export async function paymentSummary(query: PaymentQuery) {
  const where = paymentWhere(query);

  const [collected, refunded, failed, pendingBookings] = await Promise.all([
    prisma.payment.aggregate({ where: { ...where, status: "PAID" }, _sum: { amount: true }, _count: { _all: true } }),
    prisma.payment.aggregate({ where: { ...where, status: "REFUNDED" }, _sum: { amount: true }, _count: { _all: true } }),
    prisma.payment.count({ where: { ...where, status: "FAILED" } }),
    prisma.booking.aggregate({
      where: { status: { not: "CANCELLED" }, paymentStatus: { notIn: [...PAID_STATUSES, "REFUNDED"] } },
      _sum: { remainingAmount: true, totalAmount: true },
      _count: { _all: true },
    }),
  ]);

  const outstanding = toNumber(pendingBookings._sum.remainingAmount);

  return {
    collected: toNumber(collected._sum.amount),
    collectedCount: collected._count._all,
    refunded: toNumber(refunded._sum.amount),
    refundedCount: refunded._count._all,
    failed,
    // `remainingAmount` is maintained by the checkout; where it has not been
    // set it falls back to the full booking value, which is the safe reading.
    outstanding: outstanding > 0 ? outstanding : toNumber(pendingBookings._sum.totalAmount),
    outstandingCount: pendingBookings._count._all,
  };
}

/** Payment methods actually present, so the filter only offers real values. */
export async function paymentMethodOptions(): Promise<string[]> {
  const rows = await prisma.payment.groupBy({
    by: ["paymentMethod"],
    where: { paymentMethod: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { paymentMethod: "desc" } },
    take: 20,
  });
  return rows.map((row) => row.paymentMethod).filter((method): method is string => Boolean(method));
}

/* ───────────────────────── customers ───────────────────────── */

export type CustomerListRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  createdAt: Date;
  bookings: number;
  totalSpend: number;
  currency: string;
  lastTripAt: Date | null;
  status: "active" | "upcoming" | "past" | "enquiry";
};

/**
 * Customers with their booking totals.
 *
 * Spend and trip dates are aggregated per customer in the database, then
 * joined to the page of customers in memory — two bounded queries rather than
 * one per row.
 */
export async function listCustomers(query: CustomerQuery) {
  const where: Prisma.CustomerWhereInput = query.q
    ? {
        OR: [
          { name: { contains: query.q, mode: "insensitive" } },
          { email: { contains: query.q, mode: "insensitive" } },
          { phone: { contains: query.q, mode: "insensitive" } },
        ],
      }
    : {};

  const skip = (query.page - 1) * query.perPage;

  // Spend and booking-count sorts need the aggregate before the page, so they
  // are ranked in the database and the page is taken from that ranking.
  if (query.sort === "spend" || query.sort === "bookings") {
    const ranked = await prisma.booking.groupBy({
      by: ["customerId"],
      where: { status: { not: "CANCELLED" }, customer: where },
      _sum: { totalAmount: true },
      _count: { _all: true },
      orderBy:
        query.sort === "spend"
          ? { _sum: { totalAmount: "desc" } }
          : { _count: { customerId: "desc" } },
      skip,
      take: query.perPage,
    });

    const total = await prisma.customer.count({ where: { ...where, bookings: { some: {} } } });
    const customers = await prisma.customer.findMany({
      where: { id: { in: ranked.map((row) => row.customerId) } },
      select: { id: true, name: true, email: true, phone: true, city: true, country: true, createdAt: true },
    });

    const byId = new Map(customers.map((customer) => [customer.id, customer]));
    const rows = await decorate(
      ranked
        .map((row) => byId.get(row.customerId))
        .filter((customer): customer is NonNullable<typeof customer> => Boolean(customer)),
    );

    return { rows, total, page: query.page, pageCount: Math.max(1, Math.ceil(total / query.perPage)) };
  }

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: query.sort === "name" ? { name: "asc" } : { createdAt: "desc" },
      skip,
      take: query.perPage,
      select: { id: true, name: true, email: true, phone: true, city: true, country: true, createdAt: true },
    }),
    prisma.customer.count({ where }),
  ]);

  return {
    rows: await decorate(customers),
    total,
    page: query.page,
    pageCount: Math.max(1, Math.ceil(total / query.perPage)),
  };
}

type BareCustomer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string | null;
  country: string | null;
  createdAt: Date;
};

/** Attach booking totals to a page of customers in one extra query. */
async function decorate(customers: BareCustomer[]): Promise<CustomerListRow[]> {
  if (customers.length === 0) return [];

  const ids = customers.map((customer) => customer.id);

  const [totals, trips] = await Promise.all([
    prisma.booking.groupBy({
      by: ["customerId"],
      where: { customerId: { in: ids }, status: { not: "CANCELLED" } },
      _sum: { totalAmount: true },
      _count: { _all: true },
    }),
    prisma.booking.findMany({
      where: { customerId: { in: ids }, status: { not: "CANCELLED" } },
      select: { customerId: true, travelDate: true, currency: true },
      orderBy: { travelDate: "desc" },
    }),
  ]);

  const totalById = new Map(totals.map((row) => [row.customerId, row]));

  const tripById = new Map<string, { last: Date | null; next: Date | null; currency: string }>();
  const now = new Date();
  for (const trip of trips) {
    const entry = tripById.get(trip.customerId) ?? { last: null, next: null, currency: trip.currency };
    if (trip.travelDate >= now) entry.next = trip.travelDate;
    else if (!entry.last) entry.last = trip.travelDate;
    tripById.set(trip.customerId, entry);
  }

  return customers.map((customer) => {
    const totals = totalById.get(customer.id);
    const trip = tripById.get(customer.id);
    const bookings = totals?._count._all ?? 0;

    return {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      location: [customer.city, customer.country].filter(Boolean).join(", "),
      createdAt: customer.createdAt,
      bookings,
      totalSpend: toNumber(totals?._sum.totalAmount),
      currency: trip?.currency ?? "INR",
      lastTripAt: trip?.next ?? trip?.last ?? null,
      status:
        bookings === 0
          ? "enquiry"
          : trip?.next
            ? "upcoming"
            : bookings > 1
              ? "active"
              : "past",
    };
  });
}

/** Headline figures above the customers table. */
export async function customerSummary() {
  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 30);

  const [total, added, withBookings, repeat, travelling] = await Promise.all([
    prisma.customer.count(),
    prisma.customer.count({ where: { createdAt: { gte: monthAgo } } }),
    prisma.customer.count({ where: { bookings: { some: { status: { not: "CANCELLED" } } } } }),
    prisma.booking
      .groupBy({
        by: ["customerId"],
        where: { status: { not: "CANCELLED" } },
        _count: { _all: true },
        having: { customerId: { _count: { gt: 1 } } },
      })
      .then((rows) => rows.length),
    prisma.customer.count({
      where: {
        bookings: {
          some: { travelDate: { gte: new Date() }, status: { notIn: ["CANCELLED", "COMPLETED"] } },
        },
      },
    }),
  ]);

  return { total, added, withBookings, repeat, travelling };
}
