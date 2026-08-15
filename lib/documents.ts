/**
 * Central role-based access control for the admin panel.
 * Edge-safe: no imports, usable in middleware, server and client code.
 *
 * Roles:
 *  SUPER_ADMIN / ADMIN  -> everything
 *  CONTENT_MANAGER      -> website content (packages, pages, blogs, media...)
 *  BOOKING_MANAGER      -> customers & sales (bookings, leads, coupons...)
 *  SALES_EXECUTIVE      -> bookings, coupons and ONLY the leads assigned to them
 */

export type Role =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "CONTENT_MANAGER"
  | "BOOKING_MANAGER"
  | "SALES_EXECUTIVE";

const ALL: Role[] = ["SUPER_ADMIN", "ADMIN", "CONTENT_MANAGER", "BOOKING_MANAGER", "SALES_EXECUTIVE"];
const ADMINS: Role[] = ["SUPER_ADMIN", "ADMIN"];
const CONTENT: Role[] = ["SUPER_ADMIN", "ADMIN", "CONTENT_MANAGER"];
const BOOKING: Role[] = ["SUPER_ADMIN", "ADMIN", "BOOKING_MANAGER"];
const SALES: Role[] = ["SUPER_ADMIN", "ADMIN", "BOOKING_MANAGER", "SALES_EXECUTIVE"];

/** Which roles may open each /admin/<section>. */
export const SECTION_ACCESS: Record<string, Role[]> = {
  // Sales executives have no dashboard — they land straight on their leads.
  dashboard: ["SUPER_ADMIN", "ADMIN", "CONTENT_MANAGER", "BOOKING_MANAGER"],
  // Content side
  packages: CONTENT,
  destinations: CONTENT,
  blogs: CONTENT,
  pages: CONTENT,
  media: CONTENT,
  redirects: CONTENT,
  testimonials: CONTENT,
  // Booking / sales side
  bookings: SALES,
  leads: SALES,
  coupons: SALES,
  quotations: SALES,
  invoices: SALES,
  customers: BOOKING,
  reports: BOOKING,
  // Owner only
  export: ADMINS,
  users: ADMINS,
  settings: ADMINS,
};

/**
 * Roles that may only see the leads assigned to them.
 * Every lead query and lead action must respect this.
 */
export function isLeadOwnerOnly(role: string | undefined): boolean {
  return role === "SALES_EXECUTIVE";
}

/** Roles allowed to hand leads to other people. */
export function canAssignLeads(role: string | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "ADMIN" || role === "BOOKING_MANAGER";
}

/** Where a role should land after login, or when it hits a page it cannot open. */
export function landingPathFor(role: string | undefined): string {
  if (isLeadOwnerOnly(role)) return "/admin/leads";
  return "/admin/dashboard";
}

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
