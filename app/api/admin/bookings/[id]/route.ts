import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/guard";
import { hasPermission } from "@/lib/permissions";
import { toSafeError } from "@/lib/errors";
import { toNumber } from "@/lib/utils";

/**
 * One booking, for the detail drawer.
 *
 * Read-only. Changing a booking's status still goes through the existing
 * Server Action, which is where the audit trail and the permission check for
 * that change live — this route only assembles what the drawer displays.
 */

export type BookingDetail = {
  id: string;
  bookingNumber: string;
  status: string;
  paymentStatus: string;
  createdAt: string;
  travelDate: string;
  adults: number;
  children: number;
  rooms: number;
  currency: string;
  baseAmount: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  advanceAmount: number;
  remainingAmount: number;
  couponCode: string | null;
  specialRequests: string | null;
  source: string;
  campaign: string | null;
  customer: { id: string; name: string; email: string; phone: string; location: string };
  package: { id: string; name: string; destination: string; durationDays: number; durationNights: number };
  payments: {
    id: string;
    reference: string | null;
    amount: number;
    currency: string;
    status: string;
    method: string | null;
    createdAt: string;
  }[];
  can: { update: boolean };
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const actor = await currentUser();

  if (!actor || !hasPermission(actor.role, "bookings:view")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const booking = await prisma.booking.findUnique({
      where: { id },
      select: {
        id: true,
        bookingNumber: true,
        status: true,
        paymentStatus: true,
        createdAt: true,
        travelDate: true,
        adults: true,
        children: true,
        rooms: true,
        currency: true,
        baseAmount: true,
        discountAmount: true,
        taxAmount: true,
        totalAmount: true,
        advanceAmount: true,
        remainingAmount: true,
        couponCode: true,
        specialRequests: true,
        source: true,
        campaign: true,
        customer: { select: { id: true, name: true, email: true, phone: true, city: true, country: true } },
        package: {
          select: {
            id: true,
            name: true,
            durationDays: true,
            durationNights: true,
            destination: { select: { name: true } },
          },
        },
        payments: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            razorpayPaymentId: true,
            amount: true,
            currency: true,
            status: true,
            paymentMethod: true,
            createdAt: true,
          },
        },
      },
    });

    if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const detail: BookingDetail = {
      id: booking.id,
      bookingNumber: booking.bookingNumber,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      createdAt: booking.createdAt.toISOString(),
      travelDate: booking.travelDate.toISOString(),
      adults: booking.adults,
      children: booking.children,
      rooms: booking.rooms,
      currency: booking.currency,
      baseAmount: toNumber(booking.baseAmount),
      discountAmount: toNumber(booking.discountAmount),
      taxAmount: toNumber(booking.taxAmount),
      totalAmount: toNumber(booking.totalAmount),
      advanceAmount: toNumber(booking.advanceAmount),
      remainingAmount: toNumber(booking.remainingAmount),
      couponCode: booking.couponCode,
      specialRequests: booking.specialRequests,
      source: booking.source,
      campaign: booking.campaign,
      customer: {
        id: booking.customer.id,
        name: booking.customer.name,
        email: booking.customer.email,
        phone: booking.customer.phone,
        location: [booking.customer.city, booking.customer.country].filter(Boolean).join(", "),
      },
      package: {
        id: booking.package.id,
        name: booking.package.name,
        destination: booking.package.destination.name,
        durationDays: booking.package.durationDays,
        durationNights: booking.package.durationNights,
      },
      payments: booking.payments.map((payment) => ({
        id: payment.id,
        reference: payment.razorpayPaymentId,
        amount: toNumber(payment.amount),
        currency: payment.currency,
        status: payment.status,
        method: payment.paymentMethod,
        createdAt: payment.createdAt.toISOString(),
      })),
      can: { update: hasPermission(actor.role, "bookings:update") },
    };

    return NextResponse.json(detail);
  } catch (error) {
    const safe = toSafeError(error, "api.bookingDetail", { bookingId: id });
    return NextResponse.json({ error: safe.message }, { status: 500 });
  }
}
