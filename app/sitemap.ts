import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const staticRoutes: MetadataRoute.Sitemap = [
    "",
    "/destinations",
    "/packages",
    "/blog",
    "/contact",
    "/about",
  ].map((path) => ({ url: `${base}${path}`, lastModified: new Date(), changeFrequency: "weekly", priority: path === "" ? 1 : 0.7 }));

  try {
    const [packages, destinations, posts] = await Promise.all([
      prisma.travelPackage.findMany({ where: { published: true }, select: { slug: true, updatedAt: true } }),
      prisma.destination.findMany({ where: { isPublished: true }, select: { slug: true, updatedAt: true } }),
      prisma.blogPost.findMany({ where: { status: "PUBLISHED" }, select: { slug: true, updatedAt: true } }),
    ]);

    return [
      ...staticRoutes,
      ...packages.map((p) => ({ url: `${base}/packages/${p.slug}`, lastModified: p.updatedAt, priority: 0.8 })),
      ...destinations.map((d) => ({ url: `${base}/destinations/${d.slug}`, lastModified: d.updatedAt, priority: 0.8 })),
      ...posts.map((b) => ({ url: `${base}/blog/${b.slug}`, lastModified: b.updatedAt, priority: 0.6 })),
    ];
  } catch {
    return staticRoutes;
  }
}
