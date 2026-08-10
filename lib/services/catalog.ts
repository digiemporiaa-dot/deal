import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

// ── Destinations ─────────────────────────────────────────────
export function getFeaturedDestinations(limit = 6) {
  return prisma.destination.findMany({
    where: { isPublished: true, isFeatured: true },
    include: { _count: { select: { packages: true } } },
    take: limit,
    orderBy: { name: "asc" },
  });
}

export function getPublishedDestinations(filter?: { country?: string; featured?: boolean }) {
  const where: Prisma.DestinationWhereInput = { isPublished: true };
  if (filter?.country) where.country = filter.country;
  if (filter?.featured) where.isFeatured = true;
  return prisma.destination.findMany({
    where,
    include: { _count: { select: { packages: true } } },
    orderBy: [{ isFeatured: "desc" }, { name: "asc" }],
  });
}

export function getDestinationBySlug(slug: string) {
  return prisma.destination.findFirst({
    where: { slug, isPublished: true },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      faqs: { where: { published: true }, orderBy: { sortOrder: "asc" } },
      packages: {
        where: { published: true },
        include: { images: { orderBy: { sortOrder: "asc" }, take: 1 }, destination: true },
        orderBy: { featured: "desc" },
      },
    },
  });
}

// ── Packages ─────────────────────────────────────────────────
const packageCardInclude = {
  destination: { select: { name: true, slug: true, country: true } },
  category: { select: { name: true, slug: true } },
  images: { orderBy: { sortOrder: "asc" as const }, take: 1 },
} satisfies Prisma.TravelPackageInclude;

export function getFeaturedPackages(limit = 6) {
  return prisma.travelPackage.findMany({
    where: { published: true, featured: true },
    include: packageCardInclude,
    take: limit,
    orderBy: { createdAt: "desc" },
  });
}

export type PackageFilters = {
  q?: string;
  destination?: string; // slug
  category?: string; // slug
  minPrice?: number;
  maxPrice?: number;
  duration?: string; // "short" | "medium" | "long"
  sort?: string; // "price_asc" | "price_desc" | "newest"
};

export async function getPackages(filters: PackageFilters) {
  const where: Prisma.TravelPackageWhereInput = { published: true };

  if (filters.q) {
    where.OR = [
      { name: { contains: filters.q } },
      { shortDescription: { contains: filters.q } },
      { destination: { name: { contains: filters.q } } },
    ];
  }
  if (filters.destination) where.destination = { slug: filters.destination };
  if (filters.category) where.category = { slug: filters.category };
  if (filters.minPrice != null || filters.maxPrice != null) {
    where.startingPrice = {};
    if (filters.minPrice != null) where.startingPrice.gte = filters.minPrice;
    if (filters.maxPrice != null) where.startingPrice.lte = filters.maxPrice;
  }
  if (filters.duration === "short") where.durationDays = { lte: 4 };
  else if (filters.duration === "medium") where.durationDays = { gte: 5, lte: 7 };
  else if (filters.duration === "long") where.durationDays = { gte: 8 };

  let orderBy: Prisma.TravelPackageOrderByWithRelationInput = { featured: "desc" };
  if (filters.sort === "price_asc") orderBy = { startingPrice: "asc" };
  else if (filters.sort === "price_desc") orderBy = { startingPrice: "desc" };
  else if (filters.sort === "newest") orderBy = { createdAt: "desc" };

  return prisma.travelPackage.findMany({ where, include: packageCardInclude, orderBy });
}

export function getPackageBySlug(slug: string) {
  return prisma.travelPackage.findFirst({
    where: { slug, published: true },
    include: {
      destination: true,
      category: true,
      images: { orderBy: { sortOrder: "asc" } },
      itinerary: { orderBy: { sortOrder: "asc" } },
      inclusions: true,
      exclusions: true,
      hotels: true,
      activities: true,
      faqs: { where: { published: true }, orderBy: { sortOrder: "asc" } },
      reviews: { where: { published: true } },
    },
  });
}

export function getAllPackageSlugs() {
  return prisma.travelPackage.findMany({ where: { published: true }, select: { slug: true } });
}

export function getPackageCategories() {
  return prisma.packageCategory.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
}

// ── Testimonials & Blog ──────────────────────────────────────
export function getTestimonials(limit = 6) {
  return prisma.testimonial.findMany({
    where: { published: true },
    take: limit,
    orderBy: { createdAt: "desc" },
  });
}

export function getBlogPosts(limit?: number) {
  return prisma.blogPost.findMany({
    where: { status: "PUBLISHED" },
    include: { category: true, author: { select: { name: true } } },
    take: limit,
    orderBy: { publishedAt: "desc" },
  });
}

export function getBlogPostBySlug(slug: string) {
  return prisma.blogPost.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: { category: true, author: { select: { name: true } } },
  });
}
