import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { parseList } from "@/lib/utils";
import type { Prisma } from "@prisma/client";

/**
 * Related-content engine.
 *
 * Recommendations are built from real relationships — same destination, same
 * category, shared travel themes, comparable price and length — and never
 * from "whatever was published most recently". Anything that cannot be
 * related on one of those axes is left out rather than padded with filler,
 * because an unrelated link is worth less than no link at all.
 *
 * Each function returns at most `limit` items and always excludes the record
 * the visitor is already looking at.
 */

const cardSelect = {
  id: true,
  name: true,
  slug: true,
  shortDescription: true,
  durationDays: true,
  durationNights: true,
  startingPrice: true,
  discountPrice: true,
  currency: true,
  tags: true,
  categoryId: true,
  destinationId: true,
  destination: { select: { name: true, slug: true, country: true } },
  images: { orderBy: { sortOrder: "asc" as const }, take: 1, select: { url: true, alt: true } },
} satisfies Prisma.TravelPackageSelect;

export type RelatedPackage = Prisma.TravelPackageGetPayload<{ select: typeof cardSelect }>;

export type RelatedDestination = {
  id: string;
  name: string;
  slug: string;
  country: string;
  shortDescription: string;
  coverImage: string | null;
  packageCount: number;
};

export type RelatedBlog = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  publishedAt: Date | null;
  categoryName: string | null;
};

/** Overlap between two theme lists, used to rank candidates. */
function sharedTags(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const set = new Set(a.map((t) => t.toLowerCase()));
  return b.filter((t) => set.has(t.toLowerCase())).length;
}

/**
 * Packages a visitor looking at `packageId` would plausibly consider next.
 *
 * Candidates are drawn from the same destination and the same category, then
 * ranked: shared themes first, then same destination, then a similar length
 * and price. One query, ranked in memory — the candidate set is small.
 */
export const getRelatedPackages = cache(
  async (input: {
    packageId: string;
    destinationId: string;
    categoryId?: string | null;
    tags?: string[];
    durationDays?: number;
    price?: number;
    limit?: number;
  }): Promise<RelatedPackage[]> => {
    const limit = input.limit ?? 3;
    const ownTags = input.tags ?? [];

    const candidates = await prisma.travelPackage.findMany({
      where: {
        published: true,
        id: { not: input.packageId },
        OR: [
          { destinationId: input.destinationId },
          ...(input.categoryId ? [{ categoryId: input.categoryId }] : []),
        ],
      },
      select: cardSelect,
      // Bounded so a large catalogue cannot pull thousands of rows.
      take: 40,
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
    });

    const scored = candidates.map((candidate) => {
      let score = 0;
      if (candidate.destinationId === input.destinationId) score += 4;
      if (input.categoryId && candidate.categoryId === input.categoryId) score += 3;
      score += sharedTags(ownTags, parseList(candidate.tags)) * 2;

      if (input.durationDays) {
        const gap = Math.abs(candidate.durationDays - input.durationDays);
        if (gap <= 1) score += 2;
        else if (gap <= 3) score += 1;
      }
      if (input.price) {
        const candidatePrice = Number(candidate.discountPrice ?? candidate.startingPrice);
        const ratio = candidatePrice / input.price;
        // Within ±40% is the same shopping bracket.
        if (ratio >= 0.6 && ratio <= 1.4) score += 2;
      }
      return { candidate, score };
    });

    return scored
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((row) => row.candidate);
  },
);

/**
 * Destinations near or comparable to this one: same country first, then
 * anything else published, so the section is still useful for a country with
 * a single destination.
 */
export const getRelatedDestinations = cache(
  async (input: {
    destinationId: string;
    country: string;
    limit?: number;
  }): Promise<RelatedDestination[]> => {
    const limit = input.limit ?? 4;

    const [sameCountry, elsewhere] = await Promise.all([
      prisma.destination.findMany({
        where: { isPublished: true, id: { not: input.destinationId }, country: input.country },
        select: destinationSelect,
        take: limit,
        orderBy: [{ isFeatured: "desc" }, { name: "asc" }],
      }),
      prisma.destination.findMany({
        where: { isPublished: true, id: { not: input.destinationId }, country: { not: input.country } },
        select: destinationSelect,
        take: limit,
        orderBy: [{ isFeatured: "desc" }, { name: "asc" }],
      }),
    ]);

    return [...sameCountry, ...elsewhere].slice(0, limit).map(toRelatedDestination);
  },
);

const destinationSelect = {
  id: true,
  name: true,
  slug: true,
  country: true,
  shortDescription: true,
  coverImage: true,
  _count: { select: { packages: true } },
} satisfies Prisma.DestinationSelect;

function toRelatedDestination(
  row: Prisma.DestinationGetPayload<{ select: typeof destinationSelect }>,
): RelatedDestination {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    country: row.country,
    shortDescription: row.shortDescription,
    coverImage: row.coverImage,
    packageCount: row._count.packages,
  };
}

/**
 * Travel guides worth reading alongside this page.
 *
 * Posts explicitly linked to the destination or package come first (an editor
 * said so), then posts in the same category, then posts whose tags overlap.
 */
export const getRelatedBlogs = cache(
  async (input: {
    excludeId?: string;
    destinationId?: string | null;
    packageId?: string | null;
    categoryId?: string | null;
    tags?: string[];
    limit?: number;
  }): Promise<RelatedBlog[]> => {
    const limit = input.limit ?? 3;
    const ownTags = input.tags ?? [];

    const where: Prisma.BlogPostWhereInput = {
      status: "PUBLISHED",
      ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
    };

    const linkClauses: Prisma.BlogPostWhereInput[] = [];
    if (input.destinationId) linkClauses.push({ destinationId: input.destinationId });
    if (input.packageId) linkClauses.push({ packageId: input.packageId });
    if (input.categoryId) linkClauses.push({ categoryId: input.categoryId });

    // With nothing to relate to, there is no honest recommendation to make.
    if (linkClauses.length === 0 && ownTags.length === 0) return [];
    if (linkClauses.length > 0) where.OR = linkClauses;

    const candidates = await prisma.blogPost.findMany({
      where: linkClauses.length > 0 ? where : { status: "PUBLISHED", ...(input.excludeId ? { id: { not: input.excludeId } } : {}) },
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        coverImage: true,
        publishedAt: true,
        tags: true,
        destinationId: true,
        packageId: true,
        categoryId: true,
        category: { select: { name: true } },
      },
      take: 30,
      orderBy: { publishedAt: "desc" },
    });

    const scored = candidates.map((post) => {
      let score = 0;
      if (input.packageId && post.packageId === input.packageId) score += 5;
      if (input.destinationId && post.destinationId === input.destinationId) score += 4;
      if (input.categoryId && post.categoryId === input.categoryId) score += 2;
      score += sharedTags(ownTags, parseList(post.tags)) * 2;
      return { post, score };
    });

    return scored
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score || (b.post.publishedAt?.getTime() ?? 0) - (a.post.publishedAt?.getTime() ?? 0))
      .slice(0, limit)
      .map(({ post }) => ({
        id: post.id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        coverImage: post.coverImage,
        publishedAt: post.publishedAt,
        categoryName: post.category?.name ?? null,
      }));
  },
);

/**
 * Destinations with the most published packages — the ones most worth linking
 * to from anywhere on the site.
 */
export const getPopularDestinations = cache(
  async (limit = 6, excludeId?: string): Promise<RelatedDestination[]> => {
    const rows = await prisma.destination.findMany({
      where: {
        isPublished: true,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        packages: { some: { published: true } },
      },
      select: destinationSelect,
      orderBy: [{ packages: { _count: "desc" } }, { isFeatured: "desc" }, { name: "asc" }],
      take: limit,
    });
    return rows.map(toRelatedDestination);
  },
);

/** Latest published guides, for pages with nothing more specific to relate to. */
export const getLatestGuides = cache(async (limit = 3, excludeId?: string): Promise<RelatedBlog[]> => {
  const rows = await prisma.blogPost.findMany({
    where: { status: "PUBLISHED", ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      coverImage: true,
      publishedAt: true,
      category: { select: { name: true } },
    },
    orderBy: { publishedAt: "desc" },
    take: limit,
  });

  return rows.map((post) => ({
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    coverImage: post.coverImage,
    publishedAt: post.publishedAt,
    categoryName: post.category?.name ?? null,
  }));
});
