"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { guardAction } from "@/lib/guard";
import { publishBlocked } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity";
import { createSlugRedirect } from "@/lib/redirects";
import { toSafeError } from "@/lib/errors";
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
        transfers: d.transfers || null,
        sortOrder: i,
      })),
    },
    faqs: {
      create: data.faqs.map((f, i) => ({ question: f.question, answer: f.answer, sortOrder: i })),
    },
  };
}

export async function createPackage(input: PackageInput): Promise<ActionResult> {
  const guard = await guardAction("packages:create");
  if (!guard.ok) return { ok: false, error: guard.error };

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
        tags: serializeList(data.tags.filter(Boolean)),
        highlights: serializeList(data.highlights.filter(Boolean)),
        ...nestedCreateData(data),
      },
    });
    await recordActivity({
      actor: guard.actor,
      action: "CREATE",
      entity: "TravelPackage",
      entityId: pkg.id,
      description: `Created package "${pkg.name}"`,
      metadata: { slug, published: data.published },
    });

    revalidatePath("/admin/packages");
    revalidatePath("/packages");
    return { ok: true, id: pkg.id };
  } catch (err) {
    return { ok: false, error: toSafeError(err, "action.createPackage").message };
  }
}

export async function updatePackage(id: string, input: PackageInput): Promise<ActionResult> {
  const guard = await guardAction("packages:update");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = packageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", issues: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  try {
    const before = await prisma.travelPackage.findUnique({
      where: { id },
      select: { slug: true, name: true, published: true, featured: true },
    });
    if (!before) return { ok: false, error: "Package not found." };

    // Publishing state is a separate permission from editing copy.
    const publishError = publishBlocked(
      guard.actor.role,
      "packages:publish",
      before.published !== data.published || before.featured !== data.featured,
    );
    if (publishError) return { ok: false, error: publishError };

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
          tags: serializeList(data.tags.filter(Boolean)),
          highlights: serializeList(data.highlights.filter(Boolean)),
          ...nestedCreateData(data),
        },
      });
    });
    // Keep the indexed URL working when an editor renames a package.
    if (before.slug !== slug) {
      await createSlugRedirect({
        oldPath: `/packages/${before.slug}`,
        newPath: `/packages/${slug}`,
        note: `Package slug changed from ${before.slug}`,
      });
    }

    await recordActivity({
      actor: guard.actor,
      action: "UPDATE",
      entity: "TravelPackage",
      entityId: id,
      description: `Updated package "${data.name}"`,
      metadata: {
        ...(before.slug !== slug ? { slug: { from: before.slug, to: slug } } : {}),
        ...(before.published !== data.published
          ? { published: { from: before.published, to: data.published } }
          : {}),
      },
    });

    revalidatePath("/admin/packages");
    revalidatePath("/packages");
    revalidatePath(`/packages/${slug}`);
    if (before.slug !== slug) revalidatePath(`/packages/${before.slug}`);
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: toSafeError(err, "action.updatePackage", { id }).message };
  }
}

export async function deletePackage(id: string): Promise<ActionResult> {
  const guard = await guardAction("packages:delete");
  if (!guard.ok) return { ok: false, error: guard.error };
  try {
    const pkg = await prisma.travelPackage.findUnique({
      where: { id },
      select: { name: true, slug: true },
    });
    if (!pkg) return { ok: false, error: "Package not found." };

    const bookings = await prisma.booking.count({ where: { packageId: id } });
    if (bookings > 0) {
      return { ok: false, error: "Cannot delete: this package has bookings. Unpublish it instead." };
    }
    await prisma.travelPackage.delete({ where: { id } });

    await recordActivity({
      actor: guard.actor,
      action: "DELETE",
      entity: "TravelPackage",
      entityId: id,
      description: `Deleted package "${pkg.name}"`,
      metadata: { slug: pkg.slug },
    });

    revalidatePath("/admin/packages");
    revalidatePath("/packages");
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: toSafeError(err, "action.deletePackage", { id }).message };
  }
}

export async function togglePackageFlag(
  id: string,
  field: "published" | "featured",
): Promise<ActionResult> {
  const guard = await guardAction("packages:publish");
  if (!guard.ok) return { ok: false, error: guard.error };
  try {
    const pkg = await prisma.travelPackage.findUnique({
      where: { id },
      select: { name: true, published: true, featured: true },
    });
    if (!pkg) return { ok: false, error: "Not found." };

    const next = !pkg[field];
    await prisma.travelPackage.update({ where: { id }, data: { [field]: next } });

    await recordActivity({
      actor: guard.actor,
      action: "STATUS_CHANGE",
      entity: "TravelPackage",
      entityId: id,
      description: `Set ${field} to ${next} on package "${pkg.name}"`,
      metadata: { field, from: pkg[field], to: next },
    });

    revalidatePath("/admin/packages");
    revalidatePath("/packages");
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: toSafeError(err, "action.togglePackageFlag", { id, field }).message };
  }
}
