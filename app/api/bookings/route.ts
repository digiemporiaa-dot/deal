import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { bookingSchema } from "@/lib/validation";
import { createBooking } from "@/lib/services/booking";
import { isRazorpayConfigured, createRazorpayOrder } from "@/lib/razorpay";
import { toNumber } from "@/lib/utils";
import { sendMail, ADMIN_NOTIFY_EMAIL } from "@/lib/email/mailer";
import { newBookingAdminEmail } from "@/lib/email/templates";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(`booking:${ip}`, 10, 60_000)) {
    return NextResponse.json({ ok: false, error: "Too many attempts. Try again shortly." }, { status: 429 });
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
    const { booking, price } = await createBooking(parsed.data);

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
    console.error("[api/bookings] error", err);
    const message = err instanceof Error ? err.message : "Could not create booking";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
