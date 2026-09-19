import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { toNumber } from "@/lib/utils";
import { logger } from "@/lib/logger";
import type { Prisma } from "@prisma/client";

/**
 * Data loaders for the builder's dynamic elements.
 *
 * A package grid stores a *rule* ("6 featured packages") rather than a copy of
 * the packages, so the page stays current as the catalogue changes. These
 * loaders turn those rules into records.
 *
 * Every loader is request-cached and returns a plain, serialisable shape —
 * Decimal columns are converted here so the view components never deal with
 * Prisma types.
 */

export type ContentSource = "featured" | "latest" | "popular" | "manual";

export type PackageCardData = {
  id: string;
  name: string;
  slug: string;
  shortDescription: string;
  durationDays: number;
  durationNights: number;
  price: number;
  listPrice: number;
  hasDiscount: boolean;
  currency: string;
  image: string | null;
  imageAlt: string | null;
  destination: string | null;
  destinationSlug: string | null;
};

export type DestinationCardData = {
  id: string;
  name: string;
  slug: string;
  country: string;
  shortDescription: string;
  image: string | null;
  packageCount: number;
};

export type BlogCardData = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  image: string | null;
  publishedAt: Date | null;
  category: string | null;
};

export type TestimonialData = {
  id: string;
  name: string;
  text: string;
  rating: number;
  image: string | null;
};

const packageSelect = {
  id: true,
  name: true,
  slug: true,
  shortDescription: true,
  durationDays: true,
  durationNights: true,
  startingPrice: true,
  discountPrice: true,
  currency: true,
  destination: { select: { name: true, slug: true } },
  images: { orderBy: { sortOrder: "asc" as const }, take: 1, select: { url: true, alt: true } },
} satisfies Prisma.TravelPackageSelect;

function toPackageCard(
  row: Prisma.TravelPackageGetPayload<{ select: typeof packageSelect }>,
): PackageCardData {
  const listPrice = toNumber(row.startingPrice);
  const price = row.discountPrice != null ? toNumber(row.discountPrice) : listPrice;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    shortDescription: row.shortDescription,
    durationDays: row.durationDays,
    durationNights: row.durationNights,
    price,
    listPrice,
    hasDiscount: row.discountPrice != null && price < listPrice,
    currency: row.currency,
    image: row.images[0]?.url ?? null,
    imageAlt: row.images[0]?.alt ?? null,
    destination: row.destination?.name ?? null,
    destinationSlug: row.destination?.slug ?? null,
  };
}

/** Keep a manual selection in the order the admin arranged it. */
function orderByIds<T extends { id: string }>(rows: T[], ids: string[]): T[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.map((id) => byId.get(id)).filter((row): row is T => Boolean(row));
}

function clampLimit(limit: unknown, fallback: number): number {
  const value = Number(limit);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(24, Math.floor(value)));
}

function idList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").slice(0, 24);
}

export const loadPackages = cache(
  async (options: {
    source?: unknown;
    items?: unknown;
    limit?: unknown;
    destinationSlug?: unknown;
  }): Promise<PackageCardData[]> => {
    const limit = clampLimit(options.limit, 6);
    const source = String(options.source ?? "featured") as ContentSource;
    const ids = idList(options.items);

    try {
      if (source === "manual") {
        if (ids.length === 0) return [];
        const rows = await prisma.travelPackage.findMany({
          where: { id: { in: ids }, published: true },
          select: packageSelect,
        });
        return orderByIds(rows, ids).slice(0, limit).map(toPackageCard);
      }

      const where: Prisma.TravelPackageWhereInput = { published: true };
      if (source === "featured") where.featured = true;

      const destinationSlug = String(options.destinationSlug ?? "").trim();
      if (destinationSlug) where.destination = { slug: destinationSlug };

      const orderBy: Prisma.TravelPackageOrderByWithRelationInput[] =
        source === "popular"
          ? [{ bookings: { _count: "desc" } }, { featured: "desc" }]
          : source === "latest"
            ? [{ createdAt: "desc" }]
            : [{ featured: "desc" }, { createdAt: "desc" }];

      const rows = await prisma.travelPackage.findMany({
        where,
        select: packageSelect,
        orderBy,
        take: limit,
      });

      // A "featured" grid on a site with nothing featured yet should still
      // show something rather than an empty band.
      if (rows.length === 0 && source === "featured") {
        const fallback = await prisma.travelPackage.findMany({
          where: { published: true, ...(destinationSlug ? { destination: { slug: destinationSlug } } : {}) },
          select: packageSelect,
          orderBy: { createdAt: "desc" },
          take: limit,
        });
        return fallback.map(toPackageCard);
      }

      return rows.map(toPackageCard);
    } catch (error) {
      logger.error("builder.loadPackages_failed", { error });
      return [];
    }
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

export const loadDestinations = cache(
  async (options: { source?: unknown; items?: unknown; limit?: unknown }): Promise<DestinationCardData[]> => {
    const limit = clampLimit(options.limit, 6);
    const source = String(options.source ?? "featured") as ContentSource;
    const ids = idList(options.items);

    try {
      if (source === "manual") {
        if (ids.length === 0) return [];
        const rows = await prisma.destination.findMany({
          where: { id: { in: ids }, isPublished: true },
          select: destinationSelect,
        });
        return orderByIds(rows, ids)
          .slice(0, limit)
          .map((row) => ({
            id: row.id,
            name: row.name,
            slug: row.slug,
            country: row.country,
            shortDescription: row.shortDescription,
            image: row.coverImage,
            packageCount: row._count.packages,
          }));
      }

      const where: Prisma.DestinationWhereInput = { isPublished: true };
      if (source === "featured") where.isFeatured = true;

      const orderBy: Prisma.DestinationOrderByWithRelationInput[] =
        source === "popular"
          ? [{ packages: { _count: "desc" } }, { name: "asc" }]
          : source === "latest"
            ? [{ createdAt: "desc" }]
            : [{ isFeatured: "desc" }, { name: "asc" }];

      let rows = await prisma.destination.findMany({
        where,
        select: destinationSelect,
        orderBy,
        take: limit,
      });

      if (rows.length === 0 && source === "featured") {
        rows = await prisma.destination.findMany({
          where: { isPublished: true },
          select: destinationSelect,
          orderBy: { name: "asc" },
          take: limit,
        });
      }

      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        country: row.country,
        shortDescription: row.shortDescription,
        image: row.coverImage,
        packageCount: row._count.packages,
      }));
    } catch (error) {
      logger.error("builder.loadDestinations_failed", { error });
      return [];
    }
  },
);

const blogSelect = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  coverImage: true,
  publishedAt: true,
  category: { select: { name: true } },
} satisfies Prisma.BlogPostSelect;

export const loadBlogPosts = cache(
  async (options: { source?: unknown; items?: unknown; limit?: unknown }): Promise<BlogCardData[]> => {
    const limit = clampLimit(options.limit, 3);
    const source = String(options.source ?? "latest") as ContentSource;
    const ids = idList(options.items);

    try {
      if (source === "manual") {
        if (ids.length === 0) return [];
        const rows = await prisma.blogPost.findMany({
          where: { id: { in: ids }, status: "PUBLISHED" },
          select: blogSelect,
        });
        return orderByIds(rows, ids).slice(0, limit).map(toBlogCard);
      }

      const rows = await prisma.blogPost.findMany({
        where: { status: "PUBLISHED", ...(source === "featured" ? { featured: true } : {}) },
        select: blogSelect,
        orderBy: { publishedAt: "desc" },
        take: limit,
      });
      return rows.map(toBlogCard);
    } catch (error) {
      logger.error("builder.loadBlogPosts_failed", { error });
      return [];
    }
  },
);

function toBlogCard(row: Prisma.BlogPostGetPayload<{ select: typeof blogSelect }>): BlogCardData {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    image: row.coverImage,
    publishedAt: row.publishedAt,
    category: row.category?.name ?? null,
  };
}

export const loadTestimonials = cache(async (limit: unknown): Promise<TestimonialData[]> => {
  try {
    const rows = await prisma.testimonial.findMany({
      where: { published: true },
      orderBy: { createdAt: "desc" },
      take: clampLimit(limit, 6),
      select: { id: true, customerName: true, review: true, rating: true, image: true },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.customerName,
      text: row.review,
      rating: row.rating,
      image: row.image,
    }));
  } catch (error) {
    logger.error("builder.loadTestimonials_failed", { error });
    return [];
  }
});

export const loadCategories = cache(
  async (limit: unknown): Promise<{ id: string; name: string; slug: string }[]> => {
    try {
      return await prisma.packageCategory.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        take: clampLimit(limit, 6),
        select: { id: true, name: true, slug: true },
      });
    } catch (error) {
      logger.error("builder.loadCategories_failed", { error });
      return [];
    }
  },
);

/** Options for the admin's manual pickers, searchable by name. */
export async function searchCatalogue(
  resource: "package" | "destination" | "blog",
  query: string,
): Promise<{ id: string; label: string; sub?: string }[]> {
  const q = query.trim();
  const contains = q ? { contains: q, mode: "insensitive" as const } : undefined;

  if (resource === "package") {
    const rows = await prisma.travelPackage.findMany({
      where: contains ? { name: contains } : undefined,
      select: { id: true, name: true, destination: { select: { name: true } } },
      orderBy: { name: "asc" },
      take: 30,
    });
    return rows.map((row) => ({ id: row.id, label: row.name, sub: row.destination?.name }));
  }

  if (resource === "destination") {
    const rows = await prisma.destination.findMany({
      where: contains ? { name: contains } : undefined,
      select: { id: true, name: true, country: true },
      orderBy: { name: "asc" },
      take: 30,
    });
    return rows.map((row) => ({ id: row.id, label: row.name, sub: row.country }));
  }

  const rows = await prisma.blogPost.findMany({
    where: contains ? { title: contains } : undefined,
    select: { id: true, title: true, status: true },
    orderBy: { publishedAt: "desc" },
    take: 30,
  });
  return rows.map((row) => ({ id: row.id, label: row.title, sub: row.status }));
}
