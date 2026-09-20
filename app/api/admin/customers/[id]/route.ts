import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/guard";
import { hasPermission } from "@/lib/permissions";
import { toSafeError } from "@/lib/errors";
import { toNumber } from "@/lib/utils";

/**
 * One customer, for the detail drawer: profile, travel history and totals.
 *
 * Bookings are capped rather than unbounded — a repeat traveller with fifty
 * trips would otherwise send fifty rows to render a preview panel.
 */

export type CustomerDetail = {
  id: string;
  name: string;
  email: string;
  phone: string;
  whatsapp: string | null;
  location: string;
  createdAt: string;
  totals: { bookings: number; spend: number; currency: string; cancelled: number };
  bookings: {
    id: string;
    bookingNumber: string;
    packageName: string;
    destination: string;
    travelDate: string;
    totalAmount: number;
    currency: string;
    status: string;
    paymentStatus: string;
  }[];
  can: { viewBookings: boolean };
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const actor = await currentUser();

  if (!actor || !hasPermission(actor.role, "customers:view")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const customer = await prisma.customer.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        whatsapp: true,
        city: true,
        country: true,
        createdAt: true,
        bookings: {
          orderBy: { travelDate: "desc" },
          take: 20,
          select: {
            id: true,
            bookingNumber: true,
            travelDate: true,
            totalAmount: true,
            currency: true,
            status: true,
            paymentStatus: true,
            package: { select: { name: true, destination: { select: { name: true } } } },
          },
        },
      },
    });

    if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const totals = await prisma.booking.aggregate({
      where: { customerId: id, status: { not: "CANCELLED" } },
      _sum: { totalAmount: true },
      _count: { _all: true },
    });

    const cancelled = await prisma.booking.count({ where: { customerId: id, status: "CANCELLED" } });

    const detail: CustomerDetail = {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      whatsapp: customer.whatsapp,
      location: [customer.city, customer.country].filter(Boolean).join(", "),
      createdAt: customer.createdAt.toISOString(),
      totals: {
        bookings: totals._count._all,
        spend: toNumber(totals._sum.totalAmount),
        currency: customer.bookings[0]?.currency ?? "INR",
        cancelled,
      },
      bookings: customer.bookings.map((booking) => ({
        id: booking.id,
        bookingNumber: booking.bookingNumber,
        packageName: booking.package.name,
        destination: booking.package.destination.name,
        travelDate: booking.travelDate.toISOString(),
        totalAmount: toNumber(booking.totalAmount),
        currency: booking.currency,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
      })),
      can: { viewBookings: hasPermission(actor.role, "bookings:view") },
    };

    return NextResponse.json(detail);
  } catch (error) {
    const safe = toSafeError(error, "api.customerDetail", { customerId: id });
    return NextResponse.json({ error: safe.message }, { status: 500 });
  }
}
