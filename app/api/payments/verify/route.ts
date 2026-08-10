import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPaymentSignature } from "@/lib/razorpay";
import { toNumber } from "@/lib/utils";
import { sendMail } from "@/lib/email/mailer";
import { bookingConfirmationEmail, paymentReceiptEmail, paymentFailedEmail } from "@/lib/email/templates";

const verifySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid payment data" }, { status: 422 });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed.data;

  const payment = await prisma.payment.findUnique({
    where: { razorpayOrderId: razorpay_order_id },
    include: { booking: { include: { customer: true, package: { select: { name: true } } } } },
  });
  if (!payment) {
    return NextResponse.json({ ok: false, error: "Payment record not found" }, { status: 404 });
  }

  // NEVER trust the browser: verify the HMAC signature server-side.
  const valid = verifyPaymentSignature({
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    signature: razorpay_signature,
  });

  const booking = payment.booking;

  if (!valid) {
    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: { status: "FAILED", razorpayPaymentId: razorpay_payment_id },
      }),
      prisma.booking.update({
        where: { id: booking.id },
        data: { paymentStatus: "FAILED" },
      }),
    ]);
    void sendMail({
      to: booking.customer.email,
      subject: `Payment issue for booking ${booking.bookingNumber}`,
      html: paymentFailedEmail({ customerName: booking.customer.name, bookingNumber: booking.bookingNumber }),
    });
    return NextResponse.json({ ok: false, error: "Payment verification failed" }, { status: 400 });
  }

  // Success — mark paid and confirm booking, atomically.
  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: { status: "PAID", razorpayPaymentId: razorpay_payment_id, signature: razorpay_signature },
    }),
    prisma.booking.update({
      where: { id: booking.id },
      data: { paymentStatus: "PAID", status: "CONFIRMED" },
    }),
  ]);

  const emailData = {
    bookingNumber: booking.bookingNumber,
    customerName: booking.customer.name,
    packageName: booking.package.name,
    travelDate: booking.travelDate,
    travellers: booking.adults + booking.children,
    totalAmount: toNumber(booking.totalAmount),
    advanceAmount: toNumber(booking.advanceAmount),
    currency: booking.currency,
  };
  void sendMail({
    to: booking.customer.email,
    subject: `Booking confirmed — ${booking.bookingNumber}`,
    html: bookingConfirmationEmail(emailData),
  });
  void sendMail({
    to: booking.customer.email,
    subject: `Payment receipt — ${booking.bookingNumber}`,
    html: paymentReceiptEmail({ ...emailData, paymentId: razorpay_payment_id }),
  });

  return NextResponse.json({ ok: true, bookingNumber: booking.bookingNumber });
}
