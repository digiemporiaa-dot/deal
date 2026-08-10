import "server-only";
import crypto from "crypto";
import Razorpay from "razorpay";

/**
 * Razorpay integration. Works in test mode with test keys. If keys are not
 * configured, `isRazorpayConfigured()` returns false and the UI shows a clear
 * "payments not configured" state instead of a broken checkout.
 */
export function isRazorpayConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

let client: Razorpay | null = null;
function getClient(): Razorpay {
  if (!isRazorpayConfigured()) {
    throw new Error("Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.");
  }
  if (!client) {
    client = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });
  }
  return client;
}

export async function createRazorpayOrder(params: {
  amount: number; // in major units (e.g. rupees)
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}) {
  const rzp = getClient();
  return rzp.orders.create({
    amount: Math.round(params.amount * 100), // paise
    currency: params.currency,
    receipt: params.receipt,
    notes: params.notes,
    payment_capture: true,
  });
}

/** Verify the checkout callback signature (HMAC of order_id|payment_id). */
export function verifyPaymentSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${params.orderId}|${params.paymentId}`)
    .digest("hex");
  return timingSafeEqual(expected, params.signature);
}

/** Verify a Razorpay webhook signature against the raw request body. */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return timingSafeEqual(expected, signature);
}

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
