import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { toNumber } from "@/lib/utils";
import { BookingForm } from "@/components/booking/BookingForm";

export const metadata: Metadata = { title: "Book your trip", robots: { index: false } };

type Params = { params: Promise<{ slug: string }> };

export default async function BookPage({ params }: Params) {
  const { slug } = await params;
  const pkg = await prisma.travelPackage.findFirst({
    where: { slug, published: true },
    select: {
      id: true,
      name: true,
      slug: true,
      durationDays: true,
      durationNights: true,
      startingPrice: true,
      discountPrice: true,
      currency: true,
      minTravellers: true,
      maxTravellers: true,
      bookingEnabled: true,
      destination: { select: { name: true } },
      images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true, alt: true } },
    },
  });
  if (!pkg || !pkg.bookingEnabled) notFound();

  return (
    <div className="container-page py-12">
      <h1 className="font-display text-3xl font-bold text-slate-900">Book: {pkg.name}</h1>
      <p className="mt-2 text-slate-600">
        {pkg.destination.name} · {pkg.durationDays} Days / {pkg.durationNights} Nights
      </p>

      <div className="mt-8">
        <BookingForm
          pkg={{
            id: pkg.id,
            name: pkg.name,
            slug: pkg.slug,
            currency: pkg.currency,
            startingPrice: toNumber(pkg.startingPrice),
            discountPrice: pkg.discountPrice != null ? toNumber(pkg.discountPrice) : null,
            minTravellers: pkg.minTravellers,
            maxTravellers: pkg.maxTravellers,
            coverImage: pkg.images[0]?.url ?? null,
          }}
        />
      </div>
    </div>
  );
}
