"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { guardAction } from "@/lib/guard";
import { recordActivity } from "@/lib/activity";
import { toSafeError } from "@/lib/errors";
import { seoPanelSchema, type SeoPanelInput } from "@/lib/validation";
import { saveSeoMeta, type SeoEntityType } from "@/lib/seo";

const ENTITY_TYPES: SeoEntityType[] = ["PACKAGE", "DESTINATION", "BLOG", "PAGE", "ROUTE"];

/** Where each content type lives on the public site, for cache revalidation. */
const PUBLIC_PATH: Record<SeoEntityType, (slug: string) => string> = {
  PACKAGE: (slug) => `/packages/${slug}`,
  DESTINATION: (slug) => `/destinations/${slug}`,
  BLOG: (slug) => `/blog/${slug}`,
  PAGE: (slug) => `/${slug}`,
  ROUTE: () => "/",
};

/** Look up the record's slug so the right public page can be revalidated. */
async function slugFor(entityType: SeoEntityType, entityId: string): Promise<string | null> {
  switch (entityType) {
    case "PACKAGE":
      return (await prisma.travelPackage.findUnique({ where: { id: entityId }, select: { slug: true } }))?.slug ?? null;
    case "DESTINATION":
      return (await prisma.destination.findUnique({ where: { id: entityId }, select: { slug: true } }))?.slug ?? null;
    case "BLOG":
      return (await prisma.blogPost.findUnique({ where: { id: entityId }, select: { slug: true } }))?.slug ?? null;
    case "PAGE":
      return (await prisma.page.findUnique({ where: { id: entityId }, select: { slug: true } }))?.slug ?? null;
    default:
      return "";
  }
}

/**
 * Save the SEO overrides for one record.
 *
 * Kept separate from the content forms so every content type gets the same
 * controls without each form having to carry fifteen more fields.
 */
export async function saveSeoPanel(
  entityType: string,
  entityId: string,
  input: SeoPanelInput,
) {
  const guard = await guardAction("seo:manage");
  if (!guard.ok) return { ok: false as const, error: guard.error };

  if (!ENTITY_TYPES.includes(entityType as SeoEntityType)) {
    return { ok: false as const, error: "Unknown content type" };
  }
  if (!entityId.trim()) return { ok: false as const, error: "Save the content first" };

  const parsed = seoPanelSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message || "Please check the SEO fields." };
  }
  const d = parsed.data;

  // Custom JSON-LD must parse, or it is rejected here rather than shipped as
  // broken markup on a public page.
  let schemaJson: unknown = null;
  if (d.schemaJson?.trim()) {
    try {
      schemaJson = JSON.parse(d.schemaJson);
    } catch {
      return { ok: false as const, error: "The custom schema is not valid JSON." };
    }
    if (typeof schemaJson !== "object" || schemaJson === null) {
      return { ok: false as const, error: "The custom schema must be a JSON object or array." };
    }
  }

  try {
    const type = entityType as SeoEntityType;
    await saveSeoMeta(type, entityId, {
      seoTitle: d.seoTitle || null,
      seoDescription: d.seoDescription || null,
      canonicalUrl: d.canonicalUrl || null,
      focusKeyword: d.focusKeyword || null,
      ogTitle: d.ogTitle || null,
      ogDescription: d.ogDescription || null,
      ogImage: d.ogImage || null,
      twitterTitle: d.twitterTitle || null,
      twitterDescription: d.twitterDescription || null,
      twitterImage: d.twitterImage || null,
      robotsIndex: d.robotsIndex,
      robotsFollow: d.robotsFollow,
      schemaType: d.schemaType || null,
      schemaJson: schemaJson as never,
    });

    await recordActivity({
      actor: guard.actor,
      action: "UPDATE",
      entity: "Seo",
      entityId,
      description: `Updated SEO settings for ${type.toLowerCase()} ${entityId}`,
      metadata: {
        entityType: type,
        robotsIndex: d.robotsIndex,
        robotsFollow: d.robotsFollow,
        hasCanonical: Boolean(d.canonicalUrl),
        hasCustomSchema: Boolean(schemaJson),
      },
    });

    const slug = await slugFor(type, entityId);
    if (slug !== null) revalidatePath(PUBLIC_PATH[type](slug));
    revalidatePath("/sitemap.xml");

    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: toSafeError(err, "action.saveSeoPanel", { entityType, entityId }).message };
  }
}
