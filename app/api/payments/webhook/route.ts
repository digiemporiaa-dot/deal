import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyWebhookSignature } from "@/lib/razorpay";

/**
 * Razorpay webhook receiver. Verifies the signature against the RAW body, then
 * reconciles payment/booking state. Configure the endpoint + secret in the
 * Razorpay dashboard (RAZORPAY_WEBHOOK_SECRET).
 */
export async function POST(request: Request) {
  const signature = request.headers.get("x-razorpay-signature") || "";
  const rawBody = await request.text();

  if (!verifyWebhookSignature(rawBody, signature)) {
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
    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: { status: "PAID", razorpayPaymentId: entity?.id, paymentMethod: entity?.method },
      }),
      prisma.booking.update({
        where: { id: payment.bookingId },
        data: { paymentStatus: "PAID", status: "CONFIRMED" },
      }),
    ]);
  } else if (event.event === "payment.failed") {
    await prisma.$transaction([
      prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } }),
      prisma.booking.update({ where: { id: payment.bookingId }, data: { paymentStatus: "FAILED" } }),
    ]);
  }

  return NextResponse.json({ ok: true });
}
