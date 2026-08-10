"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import type { BookingStatus } from "@/types/db-enums";

const STATUSES: BookingStatus[] = [
  "PENDING", "PAYMENT_PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "REFUNDED",
];

export async function updateBookingStatus(id: string, status: string) {
  await requireAdmin();
  if (!STATUSES.includes(status as BookingStatus)) return { ok: false as const, error: "Invalid status" };
  await prisma.booking.update({ where: { id }, data: { status: status as BookingStatus } });
  revalidatePath("/admin/bookings");
  return { ok: true as const };
}
