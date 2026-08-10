import "server-only";
import nodemailer from "nodemailer";

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

export async function sendMail({ to, subject, html, replyTo }: MailInput): Promise<boolean> {
  const transport = getTransport();
  const from = process.env.EMAIL_FROM || "Vacationdeal <no-reply@vacationdeal.test>";

  if (!transport) {
    // Graceful no-op fallback — keeps flows working without SMTP configured.
    console.info(`[email:skipped-no-smtp] to=${to} subject="${subject}"`);
    return false;
  }

  try {
    await transport.sendMail({ from, to, subject, html, replyTo });
    return true;
  } catch (err) {
    console.error("[email:error]", err);
    return false;
  }
}

export const ADMIN_NOTIFY_EMAIL =
  process.env.ADMIN_NOTIFY_EMAIL || "admin@vacationdeal.test";
