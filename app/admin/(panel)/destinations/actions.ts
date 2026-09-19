"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { guardAction } from "@/lib/guard";
import { publishBlocked } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity";
import { createSlugRedirect } from "@/lib/redirects";
import { toSafeError } from "@/lib/errors";
import { destinationSchema, type DestinationInput } from "@/lib/validation";
import { slugify, serializeList } from "@/lib/utils";

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string; issues?: Record<string, string[]> };

async function uniqueSlug(base: string, ignoreId?: string): Promise<string> {
  const root = slugify(base);
  let candidate = root;
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await prisma.destination.findUnique({ where: { slug: candidate } });
    if (!existing || existing.id === ignoreId) return candidate;
    candidate = `${root}-${++n}`;
  }
}

function nested(data: DestinationInput) {
  return {
    images: { create: data.images.filter((i) => i.url).map((img, i) => ({ url: img.url, alt: img.alt || null, sortOrder: i })) },
    faqs: { create: data.faqs.map((f, i) => ({ question: f.question, answer: f.answer, sortOrder: i })) },
  };
}

function baseData(data: DestinationInput) {
  return {
    name: data.name,
    country: data.country,
    state: data.state || null,
    city: data.city || null,
    shortDescription: data.shortDescription,
    description: data.description,
    coverImage: data.coverImage || null,
    bestTimeToVisit: data.bestTimeToVisit || null,
    travelInformation: data.travelInformation || null,
    highlights: serializeList(data.highlights.filter(Boolean)),
    isFeatured: data.isFeatured,
    isPublished: data.isPublished,
    seoTitle: data.seoTitle || null,
    seoDescription: data.seoDescription || null,
  };
}

export async function createDestination(input: DestinationInput): Promise<ActionResult> {
  const guard = await guardAction("destinations:create");
  if (!guard.ok) return { ok: false, error: guard.error };
  const parsed = destinationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", issues: parsed.error.flatten().fieldErrors };
  const data = parsed.data;
  try {
    const slug = await uniqueSlug(data.slug || data.name);
    const dest = await prisma.destination.create({ data: { ...baseData(data), slug, ...nested(data) } });

    await recordActivity({
      actor: guard.actor,
      action: "CREATE",
      entity: "Destination",
      entityId: dest.id,
      description: `Created destination "${dest.name}"`,
      metadata: { slug, published: data.isPublished },
    });

    revalidatePath("/admin/destinations");
    revalidatePath("/destinations");
    return { ok: true, id: dest.id };
  } catch (err) {
    return { ok: false, error: toSafeError(err, "action.createDestination").message };
  }
}

export async function updateDestination(id: string, input: DestinationInput): Promise<ActionResult> {
  const guard = await guardAction("destinations:update");
  if (!guard.ok) return { ok: false, error: guard.error };
  const parsed = destinationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", issues: parsed.error.flatten().fieldErrors };
  const data = parsed.data;
  try {
    const before = await prisma.destination.findUnique({
      where: { id },
      select: { slug: true, isPublished: true, isFeatured: true },
    });
    if (!before) return { ok: false, error: "Destination not found." };

    const publishError = publishBlocked(
      guard.actor.role,
      "destinations:publish",
      before.isPublished !== data.isPublished || before.isFeatured !== data.isFeatured,
    );
    if (publishError) return { ok: false, error: publishError };

    const slug = await uniqueSlug(data.slug || data.name, id);
    await prisma.$transaction(async (tx) => {
      await tx.destinationImage.deleteMany({ where: { destinationId: id } });
      await tx.faq.deleteMany({ where: { destinationId: id } });
      await tx.destination.update({ where: { id }, data: { ...baseData(data), slug, ...nested(data) } });
    });

    if (before.slug !== slug) {
      await createSlugRedirect({
        oldPath: `/destinations/${before.slug}`,
        newPath: `/destinations/${slug}`,
        note: `Destination slug changed from ${before.slug}`,
      });
    }

    await recordActivity({
      actor: guard.actor,
      action: "UPDATE",
      entity: "Destination",
      entityId: id,
      description: `Updated destination "${data.name}"`,
      metadata: before.slug !== slug ? { slug: { from: before.slug, to: slug } } : undefined,
    });

    revalidatePath("/admin/destinations");
    revalidatePath("/destinations");
    revalidatePath(`/destinations/${slug}`);
    if (before.slug !== slug) revalidatePath(`/destinations/${before.slug}`);
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: toSafeError(err, "action.updateDestination", { id }).message };
  }
}

export async function deleteDestination(id: string): Promise<ActionResult> {
  const guard = await guardAction("destinations:delete");
  if (!guard.ok) return { ok: false, error: guard.error };
  try {
    const dest = await prisma.destination.findUnique({
      where: { id },
      select: { name: true, slug: true },
    });
    if (!dest) return { ok: false, error: "Destination not found." };

    const pkgCount = await prisma.travelPackage.count({ where: { destinationId: id } });
    if (pkgCount > 0) return { ok: false, error: "Cannot delete: this destination has packages. Remove them first." };
    await prisma.destination.delete({ where: { id } });

    await recordActivity({
      actor: guard.actor,
      action: "DELETE",
      entity: "Destination",
      entityId: id,
      description: `Deleted destination "${dest.name}"`,
      metadata: { slug: dest.slug },
    });

    revalidatePath("/admin/destinations");
    revalidatePath("/destinations");
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: toSafeError(err, "action.deleteDestination", { id }).message };
  }
}

export async function toggleDestinationFlag(id: string, field: "isPublished" | "isFeatured"): Promise<ActionResult> {
  const guard = await guardAction("destinations:publish");
  if (!guard.ok) return { ok: false, error: guard.error };
  try {
    const d = await prisma.destination.findUnique({
      where: { id },
      select: { name: true, isPublished: true, isFeatured: true },
    });
    if (!d) return { ok: false, error: "Not found." };

    const next = !d[field];
    await prisma.destination.update({ where: { id }, data: { [field]: next } });

    await recordActivity({
      actor: guard.actor,
      action: "STATUS_CHANGE",
      entity: "Destination",
      entityId: id,
      description: `Set ${field} to ${next} on destination "${d.name}"`,
      metadata: { field, from: d[field], to: next },
    });

    revalidatePath("/admin/destinations");
    revalidatePath("/destinations");
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: toSafeError(err, "action.toggleDestinationFlag", { id, field }).message };
  }
}
