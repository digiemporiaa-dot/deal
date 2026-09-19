import "server-only";
import nodemailer from "nodemailer";
import { logger } from "@/lib/logger";

/**
 * SMTP transport built from environment variables. If SMTP is not configured,
 * emails are logged to the console instead of throwing, so lead/booking flows
 * never break in development.
 */
let cachedTransport: nodemailer.Transporter | null = null;

function getTransport(): nodemailer.Transporter | null {
  if (cachedTransport) return cachedTransport;
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!host || !user || !pass) return null;

  cachedTransport = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
  });
  return cachedTransport;
}

export type MailInput = {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
};

/**
 * Strip anything that could break out of a header.
 *
 * Subjects and reply-to addresses come from admin input (a reply to a lead,
 * a quotation title). A carriage return or newline in a header value lets the
 * sender inject extra headers — a Bcc, a different From — so they are removed
 * before the value reaches the transport.
 */
function headerSafe(value: string, maxLength = 300): string {
  return value
    .replace(/[\r\n\u2028\u2029\u0000]+/g, " ")
    .trim()
    .slice(0, maxLength);
}

/** A single, syntactically plausible address — not a list. */
function singleAddress(value: string): string | undefined {
  const cleaned = headerSafe(value, 320);
  if (!cleaned || cleaned.includes(",") || cleaned.includes(";")) return undefined;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned) ? cleaned : undefined;
}

export async function sendMail({ to, subject, html, replyTo }: MailInput): Promise<boolean> {
  const transport = getTransport();
  const from = process.env.EMAIL_FROM || "Vacationdeal <no-reply@vacationdeal.test>";

  const recipient = singleAddress(to);
  if (!recipient) {
    logger.warn("email.invalid_recipient", {});
    return false;
  }

  const cleanSubject = headerSafe(subject) || "(no subject)";
  const cleanReplyTo = replyTo ? singleAddress(replyTo) : undefined;

  if (!transport) {
    // Graceful no-op fallback — keeps flows working without SMTP configured.
    logger.info("email.skipped_no_smtp", { to: recipient, subject: cleanSubject });
    return false;
  }

  try {
    await transport.sendMail({
      from,
      to: recipient,
      subject: cleanSubject,
      html,
      ...(cleanReplyTo ? { replyTo: cleanReplyTo } : {}),
    });
    logger.info("email.sent", { to: recipient, subject: cleanSubject });
    return true;
  } catch (err) {
    logger.error("email.send_failed", { to: recipient, error: err });
    return false;
  }
}

export const ADMIN_NOTIFY_EMAIL =
  process.env.ADMIN_NOTIFY_EMAIL || "admin@vacationdeal.test";
