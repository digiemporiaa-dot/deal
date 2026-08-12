/**
 * Central role-based access control for the admin panel.
 * Edge-safe: no imports, usable in middleware, server and client code.
 *
 * Roles:
 *  SUPER_ADMIN / ADMIN  -> everything
 *  CONTENT_MANAGER      -> website content (packages, pages, blogs, media...)
 *  BOOKING_MANAGER      -> customers & sales (bookings, leads, coupons...)
 */

export type Role = "SUPER_ADMIN" | "ADMIN" | "CONTENT_MANAGER" | "BOOKING_MANAGER";

const ALL: Role[] = ["SUPER_ADMIN", "ADMIN", "CONTENT_MANAGER", "BOOKING_MANAGER"];
const ADMINS: Role[] = ["SUPER_ADMIN", "ADMIN"];
const CONTENT: Role[] = ["SUPER_ADMIN", "ADMIN", "CONTENT_MANAGER"];
const BOOKING: Role[] = ["SUPER_ADMIN", "ADMIN", "BOOKING_MANAGER"];

/** Which roles may open each /admin/<section>. */
export const SECTION_ACCESS: Record<string, Role[]> = {
  dashboard: ALL,
  // Content side
  packages: CONTENT,
  destinations: CONTENT,
  blogs: CONTENT,
  pages: CONTENT,
  media: CONTENT,
  testimonials: CONTENT,
  // Booking / sales side
  bookings: BOOKING,
  leads: BOOKING,
  customers: BOOKING,
  coupons: BOOKING,
  // Owner only
  users: ADMINS,
  settings: ADMINS,
};

export function canAccessSection(role: string | undefined, section: string): boolean {
  const allowed = SECTION_ACCESS[section];
  if (!allowed) return true; // unknown sections fall back to "any logged-in admin user"
  return Boolean(role && (allowed as string[]).includes(role));
}

/** Check a full admin pathname like /admin/settings/whatever. */
export function canAccessPath(role: string | undefined, pathname: string): boolean {
  const match = pathname.match(/^\/admin\/([^/]+)/);
  if (!match) return true;
  const section = match[1];
  if (section === "login") return true;
  return canAccessSection(role, section);
}
