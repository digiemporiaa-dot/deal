"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
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
  try { await requireAdmin(); } catch { return { ok: false, error: "Not authorized." }; }
  const parsed = destinationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", issues: parsed.error.flatten().fieldErrors };
  const data = parsed.data;
  try {
    const slug = await uniqueSlug(data.slug || data.name);
    const dest = await prisma.destination.create({ data: { ...baseData(data), slug, ...nested(data) } });
    revalidatePath("/admin/destinations");
    revalidatePath("/destinations");
    return { ok: true, id: dest.id };
  } catch (err) {
    console.error("[createDestination]", err);
    return { ok: false, error: "Could not create destination." };
  }
}

export async function updateDestination(id: string, input: DestinationInput): Promise<ActionResult> {
  try { await requireAdmin(); } catch { return { ok: false, error: "Not authorized." }; }
  const parsed = destinationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", issues: parsed.error.flatten().fieldErrors };
  const data = parsed.data;
  try {
    const slug = await uniqueSlug(data.slug || data.name, id);
    await prisma.$transaction(async (tx) => {
      await tx.destinationImage.deleteMany({ where: { destinationId: id } });
      await tx.faq.deleteMany({ where: { destinationId: id } });
      await tx.destination.update({ where: { id }, data: { ...baseData(data), slug, ...nested(data) } });
    });
    revalidatePath("/admin/destinations");
    revalidatePath(`/destinations/${slug}`);
    return { ok: true, id };
  } catch (err) {
    console.error("[updateDestination]", err);
    return { ok: false, error: "Could not update destination." };
  }
}

export async function deleteDestination(id: string): Promise<ActionResult> {
  try { await requireAdmin(); } catch { return { ok: false, error: "Not authorized." }; }
  try {
    const pkgCount = await prisma.travelPackage.count({ where: { destinationId: id } });
    if (pkgCount > 0) return { ok: false, error: "Cannot delete: this destination has packages. Remove them first." };
    await prisma.destination.delete({ where: { id } });
    revalidatePath("/admin/destinations");
    return { ok: true, id };
  } catch {
    return { ok: false, error: "Could not delete destination." };
  }
}

export async function toggleDestinationFlag(id: string, field: "isPublished" | "isFeatured"): Promise<ActionResult> {
  try { await requireAdmin(); } catch { return { ok: false, error: "Not authorized." }; }
  try {
    const d = await prisma.destination.findUnique({ where: { id }, select: { isPublished: true, isFeatured: true } });
    if (!d) return { ok: false, error: "Not found." };
    await prisma.destination.update({ where: { id }, data: { [field]: !d[field] } });
    revalidatePath("/admin/destinations");
    revalidatePath("/destinations");
    return { ok: true, id };
  } catch {
    return { ok: false, error: "Could not update." };
  }
}
