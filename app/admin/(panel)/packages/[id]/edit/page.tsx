import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/admin/ui";
import { PackageForm } from "@/components/admin/PackageForm";
import { toNumber, parseList } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function EditPackagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [pkg, destinations, categories] = await Promise.all([
    prisma.travelPackage.findUnique({
      where: { id },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        itinerary: { orderBy: { sortOrder: "asc" } },
        inclusions: true,
        exclusions: true,
        hotels: true,
        activities: true,
        faqs: { orderBy: { sortOrder: "asc" } },
      },
    }),
    prisma.destination.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.packageCategory.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  if (!pkg) notFound();

  const initial = {
    name: pkg.name,
    slug: pkg.slug,
    destinationId: pkg.destinationId,
    categoryId: pkg.categoryId ?? "",
    shortDescription: pkg.shortDescription,
    description: pkg.description,
    durationDays: pkg.durationDays,
    durationNights: pkg.durationNights,
    startingPrice: toNumber(pkg.startingPrice),
    discountPrice: pkg.discountPrice != null ? toNumber(pkg.discountPrice) : undefined,
    currency: pkg.currency,
    minTravellers: pkg.minTravellers,
    maxTravellers: pkg.maxTravellers,
    featured: pkg.featured,
    published: pkg.published,
    bookingEnabled: pkg.bookingEnabled,
    seoTitle: pkg.seoTitle ?? "",
    seoDescription: pkg.seoDescription ?? "",
    highlights: parseList(pkg.highlights).length ? parseList(pkg.highlights).map((value) => ({ value })) : [{ value: "" }],
    inclusions: pkg.inclusions.length ? pkg.inclusions.map((i) => ({ value: i.text })) : [{ value: "" }],
    exclusions: pkg.exclusions.length ? pkg.exclusions.map((e) => ({ value: e.text })) : [{ value: "" }],
    images: pkg.images.length ? pkg.images.map((i) => ({ url: i.url, alt: i.alt ?? "" })) : [{ url: "", alt: "" }],
    itinerary: pkg.itinerary.length
      ? pkg.itinerary.map((d) => ({
          dayNumber: d.dayNumber, title: d.title, description: d.description,
          activities: d.activities ?? "", meals: d.meals ?? "", hotel: d.hotel ?? "",
        }))
      : [{ dayNumber: 1, title: "", description: "", activities: "", meals: "", hotel: "" }],
    hotels: pkg.hotels.map((h) => ({
      name: h.name, location: h.location ?? "", roomType: h.roomType ?? "", nights: h.nights, description: h.description ?? "",
    })),
    activities: pkg.activities.map((a) => ({
      name: a.name, description: a.description ?? "", price: a.price != null ? toNumber(a.price) : undefined,
    })),
    faqs: pkg.faqs.map((f) => ({ question: f.question, answer: f.answer })),
  };

  return (
    <div>
      <PageHeader title="Edit Package" description={pkg.name} />
      <PackageForm destinations={destinations} categories={categories} initial={initial} packageId={pkg.id} />
    </div>
  );
}
