import "server-only";
import { prisma } from "@/lib/db";
import { calculatePrice } from "@/lib/pricing";
import { generateBookingNumber } from "@/lib/utils";
import type { BookingInput } from "@/lib/validation";

/**
 * Create a booking with a server-authoritative price. Runs inside a transaction
 * so the customer, booking and payment records stay consistent. Returns the
 * created booking together with the price breakdown.
 */
export async function createBooking(input: BookingInput) {
  const pkg = await prisma.travelPackage.findUnique({
    where: { id: input.packageId },
    select: { id: true, name: true, published: true, bookingEnabled: true, currency: true },
  });
  if (!pkg || !pkg.published) throw new Error("Package not available");
  if (!pkg.bookingEnabled) throw new Error("Booking is disabled for this package");

  // Server-side price — client-submitted amounts are ignored entirely.
  const price = await calculatePrice({
    packageId: input.packageId,
    adults: input.adults,
    children: input.children,
    couponCode: input.couponCode || null,
  });

  const c = input.customer;

  const booking = await prisma.$transaction(async (tx) => {
    // Upsert customer by (email, phone).
    const customer = await tx.customer.upsert({
      where: { email_phone: { email: c.email.toLowerCase(), phone: c.phone } },
      update: {
        name: c.name,
        whatsapp: c.whatsapp || null,
        country: c.country || null,
        city: c.city || null,
      },
      create: {
        name: c.name,
        email: c.email.toLowerCase(),
        phone: c.phone,
        whatsapp: c.whatsapp || null,
        country: c.country || null,
        city: c.city || null,
      },
    });

    const created = await tx.booking.create({
      data: {
        bookingNumber: generateBookingNumber(),
        customerId: customer.id,
        packageId: pkg.id,
        travelDate: new Date(input.travelDate),
        adults: input.adults,
        children: input.children,
        rooms: input.rooms,
        baseAmount: price.baseAmount,
        discountAmount: price.discountAmount,
        taxAmount: price.taxAmount,
        totalAmount: price.totalAmount,
        advanceAmount: price.advanceAmount,
        remainingAmount: price.remainingAmount,
        currency: price.currency,
        couponCode: price.couponCode,
        status: "PAYMENT_PENDING",
        paymentStatus: "PENDING",
        specialRequests: input.specialRequests || null,
      },
      include: { customer: true, package: { select: { name: true } } },
    });

    return created;
  });

  return { booking, price };
}

export function getBookingByNumber(bookingNumber: string) {
  return prisma.booking.findUnique({
    where: { bookingNumber },
    include: { customer: true, package: { select: { name: true, slug: true } }, payments: true },
  });
}
