/**
 * The header the middleware uses to pass the requested pathname down to
 * Server Components.
 *
 * Next does not expose the current URL to a Server Component, and
 * `not-found.tsx` needs it: a 404 is exactly where a database-managed
 * redirect has to be resolved.
 */
export const PATHNAME_HEADER = "x-vd-pathname";
