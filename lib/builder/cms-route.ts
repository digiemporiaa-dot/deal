import { cache } from "react";
import { prisma } from "@/lib/db";
import { hasBuilderContent } from "@/components/builder/RenderDocument";

export * from "@/lib/builder/routes";

export type CmsRoutePage = {
  id: string;
  title: string;
  seoTitle: string | null;
  seoDescription: string | null;
  ogImage: string | null;
  updatedAt: Date;
  publishedContent: unknown;
};

/**
 * Load the published CMS page backing a code route, or null.
 *
 * Cached per request so `generateMetadata` and the page component share one
 * query, and failure-tolerant: a database hiccup must fall back to the
 * hand-written page rather than 500 the route.
 */
export const cmsRoutePage = cache(async (slug: string): Promise<CmsRoutePage | null> => {
  const page = await prisma.page
    .findFirst({
      where: { slug, status: "PUBLISHED" },
      select: {
        id: true,
        title: true,
        seoTitle: true,
        seoDescription: true,
        ogImage: true,
        updatedAt: true,
        publishedContent: true,
      },
    })
    .catch(() => null);

  if (!page || !hasBuilderContent(page.publishedContent)) return null;
  return page;
});
