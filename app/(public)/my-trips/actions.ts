"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { z } from "zod";
import {
  createCustomerSession,
  clearCustomerSession,
  phoneMatches,
} from "@/lib/customer-session";
import { limitFor } from "@/lib/rate-limit";
import { clientIp } from "@/lib/guard";
import { logger } from "@/lib/logger";

const loginInput = z.object({
  bookingNumber: z.string().trim().min(3).max(40),
  contact: z.string().trim().min(3).max(200),
});

/**
 * Sign in with a booking number plus the phone or email used for that booking.
 * No password — travel customers book once and forget credentials, and this
 * avoids storing another set of passwords.
 */
export async function customerLogin(bookingNumber: string, contact: string) {
  // Without a throttle this is an oracle for guessing booking numbers.
  const ip = await clientIp();
  const throttle = limitFor("login", `customer:${ip}`);
  if (!throttle.ok) {
    logger.security("customer_login_rate_limited", { ip });
    return {
      ok: false as const,
      error: "Too many attempts. Please wait a few minutes and try again.",
    };
  }

  const parsed = loginInput.safeParse({ bookingNumber, contact });
  if (!parsed.success) {
    return { ok: false as const, error: "Enter your booking number and phone or email" };
  }
  const number = parsed.data.bookingNumber.toUpperCase();
  const value = parsed.data.contact;

  const booking = await prisma.booking.findUnique({
    where: { bookingNumber: number },
    include: { customer: true },
  });

  // Same message either way, so this cannot be used to discover valid bookings.
  const failure = { ok: false as const, error: "We could not match those details. Please check and try again." };
  if (!booking?.customer) return failure;

  const matchesEmail = value.includes("@")
    ? booking.customer.email.toLowerCase() === value.toLowerCase()
    : false;
  const matchesPhone = !value.includes("@") ? phoneMatches(value, booking.customer.phone) : false;

  if (!matchesEmail && !matchesPhone) {
    logger.security("customer_login_failed", { ip, bookingNumber: number });
    return failure;
  }

  await createCustomerSession(booking.customer.id);
  logger.auth("customer_login_success", { customerId: booking.customer.id });
  revalidatePath("/my-trips");
  return { ok: true as const };
}

export async function customerLogout() {
  await clearCustomerSession();
  revalidatePath("/my-trips");
  return { ok: true as const };
}
