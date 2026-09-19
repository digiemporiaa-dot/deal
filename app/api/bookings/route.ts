import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { bookingSchema } from "@/lib/validation";
import { createBooking } from "@/lib/services/booking";
import { isRazorpayConfigured, createRazorpayOrder } from "@/lib/razorpay";
import { toNumber } from "@/lib/utils";
import { sendMail, ADMIN_NOTIFY_EMAIL } from "@/lib/email/mailer";
import { newBookingAdminEmail } from "@/lib/email/templates";
import { limitFor } from "@/lib/rate-limit";
import { ipFromRequest } from "@/lib/guard";
import { logger } from "@/lib/logger";
import { toSafeError, isAppError } from "@/lib/errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const ip = ipFromRequest(request);
  const throttle = limitFor("booking", ip);
  if (!throttle.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(throttle.retryAfter) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const parsed = bookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Please check your details.", issues: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  try {
    // Every amount below comes from createBooking(), which prices the booking
    // from the database. Nothing the browser submitted is trusted.
    const { booking, price } = await createBooking(parsed.data);

    logger.info("booking.created", {
      bookingNumber: booking.bookingNumber,
      packageId: booking.packageId,
      totalAmount: price.totalAmount,
      advanceAmount: price.advanceAmount,
      currency: price.currency,
    });

    // Notify admin of the new booking (fire-and-forget).
    void sendMail({
      to: ADMIN_NOTIFY_EMAIL,
      subject: `New booking ${booking.bookingNumber}`,
      html: newBookingAdminEmail({
        bookingNumber: booking.bookingNumber,
        customerName: booking.customer.name,
        packageName: booking.package.name,
        travelDate: booking.travelDate,
        travellers: booking.adults + booking.children,
        totalAmount: toNumber(booking.totalAmount),
        advanceAmount: toNumber(booking.advanceAmount),
        currency: booking.currency,
      }),
    });

    // If Razorpay is configured, create an order for the advance amount.
    if (isRazorpayConfigured()) {
      const order = await createRazorpayOrder({
        amount: toNumber(booking.advanceAmount),
        currency: booking.currency,
        receipt: booking.bookingNumber,
        notes: { bookingNumber: booking.bookingNumber },
      });

      await prisma.payment.create({
        data: {
          bookingId: booking.id,
          razorpayOrderId: order.id,
          amount: toNumber(booking.advanceAmount),
          currency: booking.currency,
          status: "PENDING",
        },
      });

      logger.payment("order_created", {
        bookingNumber: booking.bookingNumber,
        orderId: order.id,
        amount: toNumber(booking.advanceAmount),
        currency: booking.currency,
      });

      return NextResponse.json({
        ok: true,
        payment: "razorpay",
        bookingNumber: booking.bookingNumber,
        order: { id: order.id, amount: order.amount, currency: order.currency },
        keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        breakdown: price,
      });
    }

    // No payment gateway configured — booking is saved as an enquiry-style
    // request and the team follows up manually.
    return NextResponse.json({
      ok: true,
      payment: "manual",
      bookingNumber: booking.bookingNumber,
      breakdown: price,
    });
  } catch (err) {
    const safe = toSafeError(err, "api.bookings.create", { ip });
    // Messages such as "Package not available" are written for the customer;
    // anything else is reported generically so internals do not leak.
    const message = isAppError(err) || isExpectedBookingError(err) ? (err as Error).message : safe.message;
    return NextResponse.json({ ok: false, error: message }, { status: safe.status });
  }
}

/** Business rules thrown by createBooking() that are safe to show. */
function isExpectedBookingError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return [
    "Package not available",
    "Booking is disabled for this package",
    "Package not found",
  ].includes(err.message);
}
