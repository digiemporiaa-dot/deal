/**
 * Where CMS pages are allowed to live.
 *
 * Pure constants — no database, no React — so middleware, server actions and
 * the admin UI can all share them.
 */

/** A published page with this slug takes over the homepage. */
export const HOMEPAGE_SLUG = "home";

/**
 * Routes that exist in code but can be taken over by a CMS page.
 *
 * This is how the migration stays gradual: a hand-written route keeps
 * rendering exactly as it does today until someone publishes a builder page
 * with the matching slug, at which point the CMS version takes over. Nothing
 * is deleted, so unpublishing puts the original back.
 */
export const CMS_ROUTES: Record<string, string> = {
  [HOMEPAGE_SLUG]: "/",
  contact: "/contact",
};

/**
 * Slugs a builder page must not take, because a static route owns the URL and
 * always wins in Next.js routing — a page there could never render.
 */
export const RESERVED_SLUGS = [
  "packages",
  "destinations",
  "blog",
  "admin",
  "api",
  "my-trips",
  "booking",
];

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.includes(slug.trim().toLowerCase());
}

/** The public path a page with this slug renders at. */
export function pathForSlug(slug: string): string {
  return CMS_ROUTES[slug] ?? `/${slug}`;
}
