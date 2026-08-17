import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Set NEXT_PUBLIC_SITE_URL to your real domain — the fallback is only a safety net.
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://vacation-deal.vercel.app").replace(/\/+$/, "");

  const staticRoutes: MetadataRoute.Sitemap = [
    "",
    "/destinations",
    "/packages",
    "/blog",
    "/contact",
  ].map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: path === "" ? 1 : 0.7,
  }));

  try {
    const [packages, destinations, posts, pages] = await Promise.all([
      prisma.travelPackage.findMany({ where: { published: true }, select: { slug: true, updatedAt: true } }),
      prisma.destination.findMany({ where: { isPublished: true }, select: { slug: true, updatedAt: true } }),
      prisma.blogPost.findMany({ where: { status: "PUBLISHED" }, select: { slug: true, updatedAt: true } }),
      prisma.page.findMany({ where: { status: "PUBLISHED" }, select: { slug: true, updatedAt: true } }),
    ]);

    return [
      ...staticRoutes,
      ...packages.map((p) => ({
        url: `${base}/packages/${p.slug}`,
        lastModified: p.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
      ...destinations.map((d) => ({
        url: `${base}/destinations/${d.slug}`,
        lastModified: d.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
      ...posts.map((b) => ({
        url: `${base}/blog/${b.slug}`,
        lastModified: b.updatedAt,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      })),
      // CMS pages (About, Terms, Privacy and anything else created in Admin → Pages)
      ...pages.map((pg) => ({
        url: `${base}/${pg.slug}`,
        lastModified: pg.updatedAt,
        changeFrequency: "monthly" as const,
        priority: 0.5,
      })),
    ];
  } catch {
    return staticRoutes;
  }
}
