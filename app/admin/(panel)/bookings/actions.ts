"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { guardAction } from "@/lib/guard";
import { recordActivity } from "@/lib/activity";
import { toSafeError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { BookingStatus } from "@/types/db-enums";

const STATUSES: BookingStatus[] = [
  "PENDING", "PAYMENT_PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "REFUNDED",
];

/**
 * Change a booking's operational status.
 *
 * Payment status is deliberately NOT settable here: it is owned by the
 * Razorpay verification and webhook handlers, which are the only places that
 * have proof a payment happened.
 */
export async function updateBookingStatus(id: string, status: string) {
  const guard = await guardAction("bookings:update");
  if (!guard.ok) return { ok: false as const, error: guard.error };

  if (!STATUSES.includes(status as BookingStatus)) {
    return { ok: false as const, error: "Invalid status" };
  }

  try {
    const booking = await prisma.booking.findUnique({
      where: { id },
      select: { bookingNumber: true, status: true },
    });
    if (!booking) return { ok: false as const, error: "Booking not found" };
    if (booking.status === status) return { ok: true as const };

    await prisma.booking.update({ where: { id }, data: { status: status as BookingStatus } });

    logger.info("booking.status_changed", {
      bookingId: id,
      bookingNumber: booking.bookingNumber,
      from: booking.status,
      to: status,
      userId: guard.actor.id,
    });

    await recordActivity({
      actor: guard.actor,
      action: "STATUS_CHANGE",
      entity: "Booking",
      entityId: id,
      description: `Changed booking ${booking.bookingNumber} from ${booking.status.replace(/_/g, " ")} to ${status.replace(/_/g, " ")}`,
      metadata: { bookingNumber: booking.bookingNumber, from: booking.status, to: status },
    });

    revalidatePath("/admin/bookings");
    revalidatePath("/admin/dashboard");
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: toSafeError(err, "action.updateBookingStatus", { id }).message };
  }
}
