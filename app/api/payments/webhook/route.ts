import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { logger } from "@/lib/logger";
import { ipFromRequest } from "@/lib/guard";
import { sendMail } from "@/lib/email/mailer";
import { bookingConfirmationEmail, paymentReceiptEmail } from "@/lib/email/templates";
import { toNumber } from "@/lib/utils";

/**
 * Razorpay webhook receiver. Verifies the signature against the RAW body, then
 * reconciles payment/booking state. Configure the endpoint + secret in the
 * Razorpay dashboard (RAZORPAY_WEBHOOK_SECRET).
 */
export const runtime = "nodejs";

export async function POST(request: Request) {
  const signature = request.headers.get("x-razorpay-signature") || "";
  const rawBody = await request.text();

  if (!verifyWebhookSignature(rawBody, signature)) {
    logger.security("webhook_signature_invalid", { ip: ipFromRequest(request) });
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 400 });
  }

  let event: {
    event?: string;
    payload?: { payment?: { entity?: { order_id?: string; id?: string; method?: string } } };
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const entity = event.payload?.payment?.entity;
  const orderId = entity?.order_id;
  if (!orderId) return NextResponse.json({ ok: true }); // nothing to reconcile

  const payment = await prisma.payment.findUnique({ where: { razorpayOrderId: orderId } });
  if (!payment) return NextResponse.json({ ok: true });

  if (event.event === "payment.captured") {
    // Razorpay retries webhooks; applying this twice must be a no-op.
    if (payment.status === "PAID") {
      logger.payment("webhook_duplicate", { orderId, event: event.event });
      return NextResponse.json({ ok: true, duplicate: true });
    }
    const settled = await prisma.$transaction(async (tx) => {
      const claimed = await tx.payment.updateMany({
        where: { id: payment.id, status: { not: "PAID" } },
        data: { status: "PAID", razorpayPaymentId: entity?.id, paymentMethod: entity?.method },
      });
      if (claimed.count === 0) return false;
      await tx.booking.update({
        where: { id: payment.bookingId },
        data: { paymentStatus: "PAID", status: "CONFIRMED" },
      });
      return true;
    });
    logger.payment("webhook_captured", { orderId, paymentId: payment.id });

    /**
     * Tell the customer, but only if this request is the one that settled it.
     *
     * The browser callback in /api/payments/verify sends the same two emails
     * and claims the row the same guarded way, so exactly one of the two paths
     * ever wins and the customer is never thanked twice. Until now only that
     * callback sent anything, which meant a customer whose browser never made
     * it back — tab closed, connection dropped, or a method Razorpay only
     * confirms out of band — was charged, had their booking confirmed, and
     * heard nothing at all.
     */
    if (settled) {
      const booking = await prisma.booking
        .findUnique({
          where: { id: payment.bookingId },
          include: { customer: true, package: { select: { name: true } } },
        })
        .catch(() => null);

      if (booking?.customer?.email) {
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
          html: paymentReceiptEmail({ ...emailData, paymentId: entity?.id || payment.id }),
        });
      }
    }
  } else if (event.event === "payment.failed") {
    // A failure must never overwrite a payment that already succeeded.
    if (payment.status === "PAID") return NextResponse.json({ ok: true, ignored: true });
    await prisma.$transaction([
      prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } }),
      prisma.booking.update({ where: { id: payment.bookingId }, data: { paymentStatus: "FAILED" } }),
    ]);
    logger.payment("webhook_failed", { orderId, paymentId: payment.id });
  }

  return NextResponse.json({ ok: true });
}
