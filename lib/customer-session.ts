import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE = "vd_customer";
const MAX_AGE_DAYS = 30;

function secret(): string {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "vacation-deal-fallback-secret";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/**
 * Lightweight session for the customer portal.
 *
 * Customers never set a password — they sign in with their booking number plus
 * the phone or email on that booking. The cookie is signed with HMAC so it
 * cannot be edited by hand, and it is httpOnly so scripts cannot read it.
 */
export async function createCustomerSession(customerId: string): Promise<void> {
  const expires = Date.now() + MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const payload = `${customerId}.${expires}`;
  const value = `${payload}.${sign(payload)}`;

  const jar = await cookies();
  jar.set(COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_DAYS * 24 * 60 * 60,
  });
}

export async function getCustomerSession(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;

  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [customerId, expires, signature] = parts;

  const expected = sign(`${customerId}.${expires}`);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (Number(expires) < Date.now()) return null;

  return customerId;
}

export async function clearCustomerSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

/** Compare phone numbers ignoring spaces, dashes and country code. */
export function phoneMatches(input: string, stored: string): boolean {
  const clean = (v: string) => v.replace(/\D/g, "").slice(-10);
  const a = clean(input);
  return a.length === 10 && a === clean(stored);
}
