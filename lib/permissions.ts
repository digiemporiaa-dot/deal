/**
 * Central role-based access control.
 *
 * Edge-safe: no imports and no side effects, so this module can be used in
 * middleware, in Server Components, in Server Actions and in the browser.
 *
 * The matrix below is the single source of truth. The sidebar, the middleware
 * and every Server Action / route handler all read from it — hiding a menu item
 * is never the security boundary, `requirePermission()` in `lib/guard.ts` is.
 *
 * Roles
 * ─────
 *  SUPER_ADMIN      full access, cannot be locked out
 *  ADMIN            full access
 *  MANAGER          leads, bookings, customers, catalogue, reports
 *  BOOKING_MANAGER  sales desk: bookings, leads, customers, documents, reports
 *  CONTENT_MANAGER  website content: packages, destinations, blogs, pages, media
 *  SALES            leads, customers, bookings
 *  SALES_EXECUTIVE  bookings/documents plus ONLY the leads assigned to them
 *  EDITOR           edits existing content; cannot create, delete or publish
 *  AGENT            only the leads and bookings assigned to them
 *  VIEWER           read-only everywhere it is allowed to look
 */

export type Role =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "MANAGER"
  | "BOOKING_MANAGER"
  | "CONTENT_MANAGER"
  | "SALES"
  | "SALES_EXECUTIVE"
  | "EDITOR"
  | "AGENT"
  | "VIEWER";

export const ROLES: Role[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "BOOKING_MANAGER",
  "CONTENT_MANAGER",
  "SALES",
  "SALES_EXECUTIVE",
  "EDITOR",
  "AGENT",
  "VIEWER",
];

/** Human labels for the admin UI. */
export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  MANAGER: "Manager",
  BOOKING_MANAGER: "Booking Manager",
  CONTENT_MANAGER: "Content Manager",
  SALES: "Sales",
  SALES_EXECUTIVE: "Sales Executive",
  EDITOR: "Editor",
  AGENT: "Agent",
  VIEWER: "Viewer",
};

/** A role's label, falling back to a readable form of an unknown value. */
export function roleLabel(role: string | undefined | null): string {
  if (!role) return "No role";
  return ROLE_LABELS[role as Role] ?? role.replace(/_/g, " ").toLowerCase();
}

export type Permission =
  // Overview
  | "dashboard:view"
  | "reports:view"
  | "activity:view"
  // CRM
  | "leads:view"
  | "leads:create"
  | "leads:update"
  | "leads:delete"
  | "leads:assign"
  // Sales
  | "bookings:view"
  | "bookings:update"
  | "bookings:delete"
  | "customers:view"
  | "documents:view"
  | "documents:create"
  | "documents:update"
  | "documents:delete"
  | "documents:send"
  | "coupons:view"
  | "coupons:manage"
  // Catalogue & content
  | "packages:view"
  | "packages:create"
  | "packages:update"
  | "packages:delete"
  | "packages:publish"
  | "destinations:view"
  | "destinations:create"
  | "destinations:update"
  | "destinations:delete"
  | "destinations:publish"
  | "blogs:view"
  | "blogs:create"
  | "blogs:update"
  | "blogs:delete"
  | "blogs:publish"
  | "pages:view"
  | "pages:create"
  | "pages:update"
  | "pages:delete"
  | "testimonials:view"
  | "testimonials:manage"
  // Media
  | "media:view"
  | "media:upload"
  | "media:update"
  | "media:delete"
  // SEO
  | "seo:manage"
  | "redirects:view"
  | "redirects:manage"
  // Owner-only
  | "users:view"
  | "users:manage"
  | "settings:view"
  | "settings:manage"
  | "export:data"
  /**
   * Bulk download of invoices and quotations.
   *
   * Separate from `export:data` on purpose. A finance export is every
   * customer's name, contact details and what they paid, in one file — a
   * narrower and more sensitive thing than a package list, and something an
   * accounts role may need without also being handed a full site backup.
   */
  | "documents:export";

const READ_ONLY: Permission[] = [
  "dashboard:view",
  "reports:view",
  "leads:view",
  "bookings:view",
  "customers:view",
  "documents:view",
  "coupons:view",
  "packages:view",
  "destinations:view",
  "blogs:view",
  "pages:view",
  "testimonials:view",
  "media:view",
  "redirects:view",
];

const CONTENT_FULL: Permission[] = [
  "packages:view",
  "packages:create",
  "packages:update",
  "packages:delete",
  "packages:publish",
  "destinations:view",
  "destinations:create",
  "destinations:update",
  "destinations:delete",
  "destinations:publish",
  "blogs:view",
  "blogs:create",
  "blogs:update",
  "blogs:delete",
  "blogs:publish",
  "pages:view",
  "pages:create",
  "pages:update",
  "pages:delete",
  "testimonials:view",
  "testimonials:manage",
  "media:view",
  "media:upload",
  "media:update",
  "media:delete",
  "seo:manage",
  "redirects:view",
  "redirects:manage",
];

const SALES_DESK: Permission[] = [
  "leads:view",
  "leads:create",
  "leads:update",
  "bookings:view",
  "bookings:update",
  "customers:view",
  "documents:view",
  "documents:create",
  "documents:update",
  "documents:send",
  "coupons:view",
];

/** Every permission there is — used for the two owner roles. */
const ALL_PERMISSIONS: Permission[] = [
  ...new Set<Permission>([
    ...READ_ONLY,
    ...CONTENT_FULL,
    ...SALES_DESK,
    "activity:view",
    "leads:delete",
    "leads:assign",
    "bookings:delete",
    "documents:delete",
    "coupons:manage",
    "users:view",
    "users:manage",
    "settings:view",
    "settings:manage",
    "export:data",
    "documents:export",
  ]),
];

/** Role → permissions. A role missing from the map has no access at all. */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: ALL_PERMISSIONS,
  ADMIN: ALL_PERMISSIONS,

  MANAGER: [
    ...new Set<Permission>([
      "dashboard:view",
      "reports:view",
      "activity:view",
      ...SALES_DESK,
      "leads:delete",
      "leads:assign",
      "documents:delete",
      "coupons:manage",
      "packages:view",
      "packages:create",
      "packages:update",
      "packages:publish",
      "destinations:view",
      "destinations:create",
      "destinations:update",
      "destinations:publish",
      "media:view",
      "media:upload",
      "media:update",
      "users:view",
    ]),
  ],

  // Existing role — scope preserved exactly as it was before the upgrade.
  BOOKING_MANAGER: [
    ...new Set<Permission>([
      "dashboard:view",
      "reports:view",
      ...SALES_DESK,
      "leads:delete",
      "leads:assign",
      "documents:delete",
      "coupons:manage",
    ]),
  ],

  // Existing role — scope preserved, plus the new SEO controls.
  CONTENT_MANAGER: [...new Set<Permission>(["dashboard:view", ...CONTENT_FULL])],

  SALES: [...new Set<Permission>(["dashboard:view", ...SALES_DESK])],

  // Existing role — sees only its own leads (see isLeadOwnerOnly).
  SALES_EXECUTIVE: [
    ...new Set<Permission>([
      "leads:view",
      "leads:update",
      "bookings:view",
      "bookings:update",
      "documents:view",
      "documents:create",
      "documents:update",
      "documents:send",
      "coupons:view",
    ]),
  ],

  // Content editing only: may change existing content, never create,
  // delete or publish it.
  EDITOR: [
    "dashboard:view",
    "packages:view",
    "packages:update",
    "destinations:view",
    "destinations:update",
    "blogs:view",
    "blogs:update",
    "pages:view",
    "pages:update",
    "testimonials:view",
    "media:view",
    "media:upload",
    "media:update",
  ],

  // Works only the records assigned to them.
  AGENT: [
    "leads:view",
    "leads:update",
    "bookings:view",
    "documents:view",
    "documents:create",
  ],

  VIEWER: READ_ONLY,
};

/** Roles permitted to reach the admin area at all. */
export const ADMIN_ROLES: Role[] = ROLES;

export function isRole(value: string | undefined | null): value is Role {
  return Boolean(value && (ROLES as string[]).includes(value));
}

export function permissionsFor(role: string | undefined | null): Permission[] {
  return isRole(role) ? ROLE_PERMISSIONS[role] : [];
}

/** The authorization primitive. Everything else is built on this. */
export function hasPermission(
  role: string | undefined | null,
  permission: Permission,
): boolean {
  return permissionsFor(role).includes(permission);
}

export function hasAnyPermission(
  role: string | undefined | null,
  permissions: Permission[],
): boolean {
  const granted = permissionsFor(role);
  return permissions.some((p) => granted.includes(p));
}

/**
 * Which permission opens each /admin/<section>. Any one of them is enough,
 * because a section is readable as soon as a role can do anything in it.
 */
export const SECTION_PERMISSIONS: Record<string, Permission[]> = {
  dashboard: ["dashboard:view"],
  leads: ["leads:view"],
  // The follow-up queue is a view of the lead pipeline, so it carries the
  // same permission — without this entry an unknown section defaults to
  // admins only, and the sales roles whose work it is could not open it.
  "follow-ups": ["leads:view"],
  bookings: ["bookings:view"],
  payments: ["bookings:view"],
  customers: ["customers:view"],
  quotations: ["documents:view"],
  invoices: ["documents:view"],
  coupons: ["coupons:view"],
  packages: ["packages:view"],
  destinations: ["destinations:view"],
  blogs: ["blogs:view"],
  pages: ["pages:view"],
  testimonials: ["testimonials:view"],
  media: ["media:view"],
  redirects: ["redirects:view"],
  reports: ["reports:view"],
  "activity-log": ["activity:view"],
  users: ["users:view"],
  settings: ["settings:view"],
  // Appearance is a settings screen, so it follows the settings permission
  // rather than falling through to the admin-only default for unknown paths.
  appearance: ["settings:view"],
  export: ["export:data"],
};

/**
 * Roles that may only see the records assigned to them.
 * Every lead query and lead action must respect this.
 */
export function isLeadOwnerOnly(role: string | undefined | null): boolean {
  return role === "SALES_EXECUTIVE" || role === "AGENT";
}

/** Roles allowed to hand leads to other people. */
export function canAssignLeads(role: string | undefined | null): boolean {
  return hasPermission(role, "leads:assign");
}

export function canAccessSection(
  role: string | undefined | null,
  section: string,
): boolean {
  const required = SECTION_PERMISSIONS[section];
  // Unknown sections are closed by default: a new admin page is invisible
  // until it is given an entry above.
  if (!required) return role === "SUPER_ADMIN" || role === "ADMIN";
  return hasAnyPermission(role, required);
}

/** Check a full admin pathname such as /admin/settings/whatever. */
export function canAccessPath(
  role: string | undefined | null,
  pathname: string,
): boolean {
  const match = pathname.match(/^\/admin\/([^/]+)/);
  if (!match) return true;
  const section = match[1];
  if (section === "login") return true;
  return canAccessSection(role, section);
}

/** Where a role lands after login, or when it hits a page it cannot open. */
export function landingPathFor(role: string | undefined | null): string {
  if (canAccessSection(role, "dashboard")) return "/admin/dashboard";
  if (canAccessSection(role, "leads")) return "/admin/leads";
  if (canAccessSection(role, "bookings")) return "/admin/bookings";
  if (canAccessSection(role, "packages")) return "/admin/packages";
  return "/admin/login";
}

/**
 * Back-compat view of the matrix as section → allowed roles. Kept because the
 * previous version of this module exported it; derived so it can never drift.
 */
export const SECTION_ACCESS: Record<string, Role[]> = Object.fromEntries(
  Object.keys(SECTION_PERMISSIONS).map((section) => [
    section,
    ROLES.filter((role) => canAccessSection(role, section)),
  ]),
) as Record<string, Role[]>;

/**
 * Publishing is a separate permission from editing: an EDITOR may rewrite a
 * package but must not take it live or pull it down. Returns an error message
 * when the change is not allowed, or null when it is.
 */
export function publishBlocked(
  role: string | undefined | null,
  permission: Permission,
  publishingChanged: boolean,
): string | null {
  if (!publishingChanged) return null;
  if (hasPermission(role, permission)) return null;
  return "You can edit this content, but not change whether it is published or featured.";
}
