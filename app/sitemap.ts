import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { siteUrl } from "@/lib/seo";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * XML sitemap.
 *
 * Only pages a crawler should index appear here. Anything whose SEO settings
 * turn indexing off is filtered out, so the sitemap and the robots meta tag
 * can never contradict each other — which is the usual cause of "Submitted
 * URL marked noindex" in Search Console.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();

  const staticRoutes: MetadataRoute.Sitemap = [
    { path: "", priority: 1, changeFrequency: "daily" as const },
    { path: "/destinations", priority: 0.9, changeFrequency: "weekly" as const },
    { path: "/packages", priority: 0.9, changeFrequency: "daily" as const },
    { path: "/blog", priority: 0.7, changeFrequency: "weekly" as const },
    { path: "/contact", priority: 0.5, changeFrequency: "monthly" as const },
  ].map((route) => ({
    url: `${base}${route.path}`,
    lastModified: new Date(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  try {
    const [packages, destinations, posts, pages, noIndexed] = await Promise.all([
      prisma.travelPackage.findMany({
        where: { published: true },
        select: { id: true, slug: true, updatedAt: true },
      }),
      prisma.destination.findMany({
        where: { isPublished: true },
        select: { id: true, slug: true, updatedAt: true },
      }),
      prisma.blogPost.findMany({
        where: { status: "PUBLISHED" },
        select: { id: true, slug: true, updatedAt: true },
      }),
      prisma.page.findMany({
        where: { status: "PUBLISHED" },
        select: { id: true, slug: true, updatedAt: true },
      }),
      // One query for every record an admin has marked "do not index".
      prisma.seoMeta.findMany({
        where: { robotsIndex: false },
        select: { entityType: true, entityId: true },
      }),
    ]);

    const excluded = new Set(noIndexed.map((row) => `${row.entityType}:${row.entityId}`));
    const indexable = <T extends { id: string }>(type: string, rows: T[]) =>
      rows.filter((row) => !excluded.has(`${type}:${row.id}`));

    return [
      ...staticRoutes,
      ...indexable("PACKAGE", packages).map((p) => ({
        url: `${base}/packages/${p.slug}`,
        lastModified: p.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
      ...indexable("DESTINATION", destinations).map((d) => ({
        url: `${base}/destinations/${d.slug}`,
        lastModified: d.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
      ...indexable("BLOG", posts).map((b) => ({
        url: `${base}/blog/${b.slug}`,
        lastModified: b.updatedAt,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      })),
      // CMS pages (About, Terms, Privacy and anything else created in Admin → Pages)
      ...indexable("PAGE", pages).map((pg) => ({
        url: `${base}/${pg.slug}`,
        lastModified: pg.updatedAt,
        changeFrequency: "monthly" as const,
        priority: 0.5,
      })),
    ];
  } catch (error) {
    // A sitemap with the static routes beats a 500.
    logger.error("sitemap.build_failed", { error });
    return staticRoutes;
  }
}
