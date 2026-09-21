import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  CalendarCheck,
  ClipboardList,
  Download,
  FileSpreadsheet,
  FileText,
  Files,
  Image as ImageIcon,
  IndianRupee,
  LayoutDashboard,
  LayoutTemplate,
  MapPin,
  Package,
  ReceiptIndianRupee,
  Settings,
  Shuffle,
  Star,
  Tag,
  UserCog,
  Users,
  Wallet,
  Palette,
} from "lucide-react";
import { canAccessSection } from "@/lib/permissions";

/**
 * Admin navigation.
 *
 * Grouped by what someone is doing rather than by database table — a sales
 * agent thinks "my leads", not "the Lead entity". Each item names the
 * permission section it belongs to so the sidebar, the command palette and
 * quick-create all filter from one source instead of three drifting copies.
 */

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Permission section (the first path segment under /admin). */
  section: string;
  /** Matches child routes too — set false for a parent that has siblings. */
  exact?: boolean;
};

export type NavGroup = {
  id: string;
  label: string | null;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "main",
    label: null,
    items: [
      { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, section: "dashboard" },
    ],
  },
  {
    id: "crm",
    label: "CRM",
    items: [
      { href: "/admin/leads", label: "Leads", icon: ClipboardList, section: "leads" },
      { href: "/admin/customers", label: "Customers", icon: Users, section: "customers" },
      { href: "/admin/leads?due=today", label: "Follow-ups", icon: CalendarCheck, section: "leads", exact: true },
    ],
  },
  {
    id: "bookings",
    label: "Bookings",
    items: [
      { href: "/admin/bookings", label: "All bookings", icon: CalendarCheck, section: "bookings" },
      { href: "/admin/payments", label: "Payments", icon: Wallet, section: "bookings" },
      { href: "/admin/bookings?upcoming=1", label: "Upcoming trips", icon: IndianRupee, section: "bookings", exact: true },
      { href: "/admin/quotations", label: "Quotations", icon: FileSpreadsheet, section: "quotations" },
      { href: "/admin/invoices", label: "Invoices", icon: ReceiptIndianRupee, section: "invoices" },
    ],
  },
  {
    id: "travel",
    label: "Travel",
    items: [
      { href: "/admin/destinations", label: "Destinations", icon: MapPin, section: "destinations" },
      { href: "/admin/packages", label: "Packages", icon: Package, section: "packages" },
      { href: "/admin/testimonials", label: "Testimonials", icon: Star, section: "testimonials" },
    ],
  },
  {
    id: "content",
    label: "Content",
    items: [
      { href: "/admin/pages", label: "Pages", icon: Files, section: "pages" },
      { href: "/admin/pages/templates", label: "Page templates", icon: LayoutTemplate, section: "pages", exact: true },
      { href: "/admin/blogs", label: "Blog", icon: FileText, section: "blogs" },
      { href: "/admin/media", label: "Media library", icon: ImageIcon, section: "media" },
      { href: "/admin/redirects", label: "Redirects", icon: Shuffle, section: "redirects" },
    ],
  },
  {
    id: "marketing",
    label: "Marketing",
    items: [{ href: "/admin/coupons", label: "Coupons", icon: Tag, section: "coupons" }],
  },
  {
    id: "analytics",
    label: "Analytics",
    items: [
      { href: "/admin/reports", label: "Reports", icon: BarChart3, section: "reports" },
      { href: "/admin/export", label: "Export & backup", icon: Download, section: "export" },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      { href: "/admin/users", label: "Users & roles", icon: UserCog, section: "users" },
      { href: "/admin/activity-log", label: "Activity log", icon: Activity, section: "activity-log" },
      { href: "/admin/appearance", label: "Appearance", icon: Palette, section: "settings" },
      { href: "/admin/settings", label: "Settings", icon: Settings, section: "settings" },
    ],
  },
];

/** The groups this role may actually open. Empty groups are dropped. */
export function navigationFor(role: string | undefined | null): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => canAccessSection(role, item.section)),
  })).filter((group) => group.items.length > 0);
}

/**
 * Whether a nav item should read as current.
 *
 * Items that carry a query string (Follow-ups, Upcoming trips) are filtered
 * views of another page, so they only light up on an exact match — otherwise
 * opening Leads would highlight both Leads and Follow-ups.
 */
export function isNavItemActive(item: NavItem, pathname: string, search: string): boolean {
  const [path, query] = item.href.split("?");

  if (query) return pathname === path && search === query;
  if (item.exact) return pathname === path && !search;

  return pathname === path || pathname.startsWith(`${path}/`);
}

/** Human labels for path segments, used to build breadcrumbs. */
const SEGMENT_LABELS: Record<string, string> = {
  admin: "Admin",
  dashboard: "Dashboard",
  leads: "Leads",
  customers: "Customers",
  bookings: "Bookings",
  payments: "Payments",
  packages: "Packages",
  destinations: "Destinations",
  blogs: "Blog",
  pages: "Pages",
  templates: "Templates",
  sections: "Reusable sections",
  builder: "Page builder",
  revisions: "Revisions",
  media: "Media library",
  coupons: "Coupons",
  testimonials: "Testimonials",
  quotations: "Quotations",
  invoices: "Invoices",
  redirects: "Redirects",
  reports: "Reports",
  "activity-log": "Activity log",
  users: "Users & roles",
  settings: "Settings",
  export: "Export & backup",
  new: "New",
  edit: "Edit",
};

export function labelForSegment(segment: string): string {
  return (
    SEGMENT_LABELS[segment] ??
    segment.replace(/-/g, " ").replace(/^./, (character) => character.toUpperCase())
  );
}

/**
 * Breadcrumbs from a pathname.
 *
 * Record ids are opaque, so a segment that looks like one is shown as the
 * action that follows it ("Leads / Edit") rather than as a cuid nobody reads.
 */
export function breadcrumbsFor(pathname: string): { label: string; href?: string }[] {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: { label: string; href?: string }[] = [];
  let href = "";

  for (const [index, segment] of segments.entries()) {
    href += `/${segment}`;
    if (segment === "admin") continue;

    // A cuid-ish segment is a record id; it has no useful label of its own.
    if (/^[a-z0-9]{20,}$/i.test(segment)) continue;

    crumbs.push({
      label: labelForSegment(segment),
      href: index === segments.length - 1 ? undefined : href,
    });
  }

  return crumbs.length > 0 ? crumbs : [{ label: "Dashboard" }];
}
