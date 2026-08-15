"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import {
  createCustomerSession,
  clearCustomerSession,
  phoneMatches,
} from "@/lib/customer-session";

/**
 * Sign in with a booking number plus the phone or email used for that booking.
 * No password — travel customers book once and forget credentials, and this
 * avoids storing another set of passwords.
 */
export async function customerLogin(bookingNumber: string, contact: string) {
  const number = bookingNumber.trim().toUpperCase();
  const value = contact.trim();
  if (!number || !value) return { ok: false as const, error: "Enter your booking number and phone or email" };

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

  if (!matchesEmail && !matchesPhone) return failure;

  await createCustomerSession(booking.customer.id);
  revalidatePath("/my-trips");
  return { ok: true as const };
}

export async function customerLogout() {
  await clearCustomerSession();
  revalidatePath("/my-trips");
  return { ok: true as const };
}
