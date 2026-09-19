import "server-only";
import type { Metadata } from "next";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { excerptFrom } from "@/lib/sanitize";
import type { Prisma } from "@prisma/client";

/**
 * One place that builds page metadata and structured data.
 *
 * Each indexable record may carry a `SeoMeta` row (canonical, robots, OG and
 * X/Twitter cards, focus keyword, extra JSON-LD). Where there is none, the
 * legacy `seoTitle` / `seoDescription` columns are used, and where there is
 * neither, the page's own content is. Nothing that existed before stops
 * working — the overrides sit on top of it.
 */

export type SeoEntityType = "PACKAGE" | "DESTINATION" | "BLOG" | "PAGE" | "ROUTE";

export type SeoOverrides = {
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
  focusKeyword: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  twitterTitle: string | null;
  twitterDescription: string | null;
  twitterImage: string | null;
  robotsIndex: boolean;
  robotsFollow: boolean;
  schemaType: string | null;
  schemaJson: Prisma.JsonValue | null;
};

/** Everything a page can offer before the overrides are applied. */
export type SeoSource = {
  /** Path on this site, always starting with "/". */
  path: string;
  title: string;
  description?: string | null;
  image?: string | null;
  /** Lets a draft or unlisted record opt out of indexing by itself. */
  noIndex?: boolean;
  publishedAt?: Date | null;
  updatedAt?: Date | null;
  type?: "website" | "article" | "product";
};

/** The canonical origin, with any trailing slash removed. */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
}

/** Absolute URL for a path or a possibly-relative asset URL. */
export function absoluteUrl(pathOrUrl: string | null | undefined): string | undefined {
  if (!pathOrUrl) return undefined;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${siteUrl()}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

/**
 * The canonical URL for a page: an explicit override when one is set,
 * otherwise the page's own path with query strings and trailing slashes
 * removed, so filtered and paginated variants do not compete with each other.
 */
export function generateCanonical(path: string, override?: string | null): string {
  if (override) return absoluteUrl(override)!;
  const clean = path.split("?")[0]!.split("#")[0]!.replace(/\/+$/, "");
  return `${siteUrl()}${clean || "/"}`;
}

/**
 * Read the SEO overrides for one record. Cached per request, so a page that
 * builds metadata and then renders schema only queries once.
 */
export const getSeoMeta = cache(
  async (entityType: SeoEntityType, entityId: string): Promise<SeoOverrides | null> => {
    if (!entityId) return null;
    try {
      const row = await prisma.seoMeta.findUnique({
        where: { entityType_entityId: { entityType, entityId } },
      });
      if (!row) return null;
      return {
        seoTitle: row.seoTitle,
        seoDescription: row.seoDescription,
        canonicalUrl: row.canonicalUrl,
        focusKeyword: row.focusKeyword,
        ogTitle: row.ogTitle,
        ogDescription: row.ogDescription,
        ogImage: row.ogImage,
        twitterTitle: row.twitterTitle,
        twitterDescription: row.twitterDescription,
        twitterImage: row.twitterImage,
        robotsIndex: row.robotsIndex,
        robotsFollow: row.robotsFollow,
        schemaType: row.schemaType,
        schemaJson: row.schemaJson,
      };
    } catch {
      // SEO overrides are an enhancement: a database hiccup must not take the
      // public page down with it.
      return null;
    }
  },
);

/** Save (or clear) the overrides for one record. */
export async function saveSeoMeta(
  entityType: SeoEntityType,
  entityId: string,
  input: Partial<SeoOverrides>,
): Promise<void> {
  const data = {
    seoTitle: input.seoTitle || null,
    seoDescription: input.seoDescription || null,
    canonicalUrl: input.canonicalUrl || null,
    focusKeyword: input.focusKeyword || null,
    ogTitle: input.ogTitle || null,
    ogDescription: input.ogDescription || null,
    ogImage: input.ogImage || null,
    twitterTitle: input.twitterTitle || null,
    twitterDescription: input.twitterDescription || null,
    twitterImage: input.twitterImage || null,
    robotsIndex: input.robotsIndex ?? true,
    robotsFollow: input.robotsFollow ?? true,
    schemaType: input.schemaType || null,
    schemaJson: (input.schemaJson ?? undefined) as Prisma.InputJsonValue | undefined,
  };

  await prisma.seoMeta.upsert({
    where: { entityType_entityId: { entityType, entityId } },
    create: { entityType, entityId, ...data },
    update: data,
  });
}

/**
 * Build a Next.js Metadata object from a page's own content plus its overrides.
 *
 * Titles fall back down the chain override → page title; descriptions do the
 * same and are trimmed to a length search engines will actually show.
 */
export async function buildMetadata(
  source: SeoSource,
  overrides?: SeoOverrides | null,
): Promise<Metadata> {
  const settings = await getSettings();

  const title = overrides?.seoTitle || source.title;
  const description =
    overrides?.seoDescription || excerptFrom(source.description ?? "", 158) || settings.tagline;

  const canonical = generateCanonical(source.path, overrides?.canonicalUrl);
  const image = absoluteUrl(overrides?.ogImage || source.image || settings.logoUrl || null);

  const twitterImage = absoluteUrl(overrides?.twitterImage) ?? image;

  // A record marked noindex, or an override turning indexing off, wins over
  // the default.
  const index = source.noIndex ? false : (overrides?.robotsIndex ?? true);
  const follow = overrides?.robotsFollow ?? true;

  return {
    title,
    description,
    keywords: overrides?.focusKeyword ? [overrides.focusKeyword] : undefined,
    alternates: { canonical },
    robots: {
      index,
      follow,
      googleBot: { index, follow },
    },
    openGraph: {
      type: source.type === "article" ? "article" : "website",
      url: canonical,
      siteName: settings.siteName,
      title: overrides?.ogTitle || title,
      description: overrides?.ogDescription || description,
      images: image ? [{ url: image }] : undefined,
      ...(source.type === "article"
        ? {
            publishedTime: source.publishedAt?.toISOString(),
            modifiedTime: source.updatedAt?.toISOString(),
          }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: overrides?.twitterTitle || overrides?.ogTitle || title,
      description: overrides?.twitterDescription || overrides?.ogDescription || description,
      // A dedicated X image if one is set, otherwise reuse the OG image.
      images: twitterImage ? [twitterImage] : undefined,
    },
  };
}

/* ──────────────────────── structured data ──────────────────────── */

type Json = Record<string, unknown>;

const CONTEXT = "https://schema.org";

/** Organization — emitted once, on the homepage. */
export async function organizationSchema(): Promise<Json> {
  const settings = await getSettings();
  const url = siteUrl();
  const sameAs = Object.values(settings.social).filter(Boolean);

  return {
    "@context": CONTEXT,
    "@type": "TravelAgency",
    "@id": `${url}/#organization`,
    name: settings.siteName,
    url,
    description: settings.tagline,
    ...(settings.logoUrl ? { logo: absoluteUrl(settings.logoUrl) } : {}),
    ...(settings.email || settings.phone
      ? {
          contactPoint: {
            "@type": "ContactPoint",
            contactType: "customer service",
            ...(settings.phone ? { telephone: settings.phone } : {}),
            ...(settings.email ? { email: settings.email } : {}),
          },
        }
      : {}),
    ...(settings.address ? { address: { "@type": "PostalAddress", streetAddress: settings.address } } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };
}

/** WebSite, with the site search action — emitted once, on the homepage. */
export async function websiteSchema(): Promise<Json> {
  const settings = await getSettings();
  const url = siteUrl();

  return {
    "@context": CONTEXT,
    "@type": "WebSite",
    "@id": `${url}/#website`,
    name: settings.siteName,
    url,
    publisher: { "@id": `${url}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${url}/packages?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbSchema(items: { name: string; path: string }[]): Json {
  return {
    "@context": CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

/**
 * FAQPage — only worth emitting when the questions are actually rendered on
 * the page, which is what the guidelines require.
 */
export function faqSchema(faqs: { question: string; answer: string }[]): Json | null {
  if (faqs.length === 0) return null;
  return {
    "@context": CONTEXT,
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };
}

export function touristDestinationSchema(input: {
  name: string;
  description: string;
  path: string;
  image?: string | null;
  country: string;
  state?: string | null;
  city?: string | null;
}): Json {
  return {
    "@context": CONTEXT,
    "@type": "TouristDestination",
    name: input.name,
    description: input.description,
    url: absoluteUrl(input.path),
    ...(input.image ? { image: absoluteUrl(input.image) } : {}),
    address: {
      "@type": "PostalAddress",
      addressCountry: input.country,
      ...(input.state ? { addressRegion: input.state } : {}),
      ...(input.city ? { addressLocality: input.city } : {}),
    },
  };
}

/**
 * A holiday package, described both as the trip it is and as the thing being
 * sold. `aggregateRating` is included only when real published reviews exist —
 * inventing one would be misleading markup.
 */
export function touristTripSchema(input: {
  name: string;
  description: string;
  path: string;
  images: string[];
  price: number;
  currency: string;
  durationDays: number;
  destination?: { name: string; country: string } | null;
  reviewCount?: number;
  ratingValue?: number | null;
  inStock: boolean;
}): Json {
  const url = absoluteUrl(input.path)!;

  return {
    "@context": CONTEXT,
    "@type": "TouristTrip",
    name: input.name,
    description: input.description,
    url,
    ...(input.images.length ? { image: input.images.map((i) => absoluteUrl(i)!) } : {}),
    // ISO 8601 duration, e.g. a 5-day trip is P5D.
    itinerary: input.destination
      ? {
          "@type": "ItemList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              item: {
                "@type": "TouristDestination",
                name: input.destination.name,
                address: { "@type": "PostalAddress", addressCountry: input.destination.country },
              },
            },
          ],
        }
      : undefined,
    ...(input.durationDays > 0 ? { duration: `P${input.durationDays}D` } : {}),
    offers: {
      "@type": "Offer",
      url,
      price: input.price,
      priceCurrency: input.currency,
      availability: input.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
    ...(input.reviewCount && input.reviewCount > 0 && input.ratingValue
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: Math.round(input.ratingValue * 10) / 10,
            reviewCount: input.reviewCount,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  };
}

export async function articleSchema(input: {
  title: string;
  description: string;
  path: string;
  image?: string | null;
  authorName?: string | null;
  publishedAt?: Date | null;
  updatedAt?: Date | null;
}): Promise<Json> {
  const settings = await getSettings();
  const url = siteUrl();

  return {
    "@context": CONTEXT,
    "@type": "Article",
    headline: input.title.slice(0, 110),
    description: input.description,
    mainEntityOfPage: { "@type": "WebPage", "@id": absoluteUrl(input.path) },
    ...(input.image ? { image: [absoluteUrl(input.image)!] } : {}),
    author: { "@type": input.authorName ? "Person" : "Organization", name: input.authorName || settings.siteName },
    publisher: { "@id": `${url}/#organization` },
    ...(input.publishedAt ? { datePublished: input.publishedAt.toISOString() } : {}),
    ...(input.updatedAt ? { dateModified: input.updatedAt.toISOString() } : {}),
  };
}

/**
 * Merge an admin-supplied JSON-LD override into the generated graph.
 * Invalid JSON is ignored rather than rendered — bad markup is worse than none.
 */
export function extraSchema(schemaJson: Prisma.JsonValue | null | undefined): Json[] {
  if (!schemaJson) return [];
  const value =
    typeof schemaJson === "string" ? safeParse(schemaJson) : (schemaJson as unknown);
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  return list.filter((item): item is Json => Boolean(item) && typeof item === "object");
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
