"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { packageSchema, type PackageInput } from "@/lib/validation";
import { slugify, serializeList } from "@/lib/utils";

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string; issues?: Record<string, string[]> };

async function uniqueSlug(base: string, ignoreId?: string): Promise<string> {
  const root = slugify(base);
  let candidate = root;
  let n = 1;
  // Ensure uniqueness against other packages.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await prisma.travelPackage.findUnique({ where: { slug: candidate } });
    if (!existing || existing.id === ignoreId) return candidate;
    candidate = `${root}-${++n}`;
  }
}

function nestedCreateData(data: PackageInput) {
  return {
    images: {
      create: data.images.map((img, i) => ({ url: img.url, alt: img.alt || null, sortOrder: i })),
    },
    inclusions: { create: data.inclusions.filter(Boolean).map((text) => ({ text })) },
    exclusions: { create: data.exclusions.filter(Boolean).map((text) => ({ text })) },
    hotels: {
      create: data.hotels.map((h) => ({
        name: h.name, location: h.location || null, roomType: h.roomType || null,
        nights: h.nights, description: h.description || null,
      })),
    },
    activities: {
      create: data.activities.map((a) => ({
        name: a.name, description: a.description || null, price: a.price ?? null,
      })),
    },
    itinerary: {
      create: data.itinerary.map((d, i) => ({
        dayNumber: d.dayNumber || i + 1,
        title: d.title,
        description: d.description || "",
        activities: d.activities || null,
        meals: d.meals || null,
        hotel: d.hotel || null,
        sortOrder: i,
      })),
    },
    faqs: {
      create: data.faqs.map((f, i) => ({ question: f.question, answer: f.answer, sortOrder: i })),
    },
  };
}

export async function createPackage(input: PackageInput): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = packageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", issues: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  try {
    const slug = await uniqueSlug(data.slug || data.name);
    const pkg = await prisma.travelPackage.create({
      data: {
        name: data.name,
        slug,
        destinationId: data.destinationId,
        categoryId: data.categoryId || null,
        shortDescription: data.shortDescription,
        description: data.description,
        durationDays: data.durationDays,
        durationNights: data.durationNights,
        startingPrice: data.startingPrice,
        discountPrice: data.discountPrice ?? null,
        currency: data.currency,
        minTravellers: data.minTravellers,
        maxTravellers: data.maxTravellers,
        featured: data.featured,
        published: data.published,
        bookingEnabled: data.bookingEnabled,
        seoTitle: data.seoTitle || null,
        seoDescription: data.seoDescription || null,
        highlights: serializeList(data.highlights.filter(Boolean)),
        ...nestedCreateData(data),
      },
    });
    revalidatePath("/admin/packages");
    revalidatePath("/packages");
    return { ok: true, id: pkg.id };
  } catch (err) {
    console.error("[createPackage]", err);
    return { ok: false, error: "Could not create package." };
  }
}

export async function updatePackage(id: string, input: PackageInput): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Not authorized." };
  }

  const parsed = packageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", issues: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  try {
    const slug = await uniqueSlug(data.slug || data.name, id);
    // Replace nested children wholesale for clean repeater semantics.
    await prisma.$transaction(async (tx) => {
      await tx.packageImage.deleteMany({ where: { packageId: id } });
      await tx.packageInclusion.deleteMany({ where: { packageId: id } });
      await tx.packageExclusion.deleteMany({ where: { packageId: id } });
      await tx.packageHotel.deleteMany({ where: { packageId: id } });
      await tx.packageActivity.deleteMany({ where: { packageId: id } });
      await tx.itineraryDay.deleteMany({ where: { packageId: id } });
      await tx.faq.deleteMany({ where: { packageId: id } });

      await tx.travelPackage.update({
        where: { id },
        data: {
          name: data.name,
          slug,
          destinationId: data.destinationId,
          categoryId: data.categoryId || null,
          shortDescription: data.shortDescription,
          description: data.description,
          durationDays: data.durationDays,
          durationNights: data.durationNights,
          startingPrice: data.startingPrice,
          discountPrice: data.discountPrice ?? null,
          currency: data.currency,
          minTravellers: data.minTravellers,
          maxTravellers: data.maxTravellers,
          featured: data.featured,
          published: data.published,
          bookingEnabled: data.bookingEnabled,
          seoTitle: data.seoTitle || null,
          seoDescription: data.seoDescription || null,
          highlights: serializeList(data.highlights.filter(Boolean)),
          ...nestedCreateData(data),
        },
      });
    });
    revalidatePath("/admin/packages");
    revalidatePath(`/packages/${slug}`);
    return { ok: true, id };
  } catch (err) {
    console.error("[updatePackage]", err);
    return { ok: false, error: "Could not update package." };
  }
}

export async function deletePackage(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Not authorized." };
  }
  try {
    const bookings = await prisma.booking.count({ where: { packageId: id } });
    if (bookings > 0) {
      return { ok: false, error: "Cannot delete: this package has bookings. Unpublish it instead." };
    }
    await prisma.travelPackage.delete({ where: { id } });
    revalidatePath("/admin/packages");
    return { ok: true, id };
  } catch (err) {
    console.error("[deletePackage]", err);
    return { ok: false, error: "Could not delete package." };
  }
}

export async function togglePackageFlag(
  id: string,
  field: "published" | "featured",
): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Not authorized." };
  }
  try {
    const pkg = await prisma.travelPackage.findUnique({ where: { id }, select: { published: true, featured: true } });
    if (!pkg) return { ok: false, error: "Not found." };
    await prisma.travelPackage.update({ where: { id }, data: { [field]: !pkg[field] } });
    revalidatePath("/admin/packages");
    revalidatePath("/packages");
    return { ok: true, id };
  } catch {
    return { ok: false, error: "Could not update." };
  }
}
