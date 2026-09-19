import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AdminShell } from "@/components/admin/AdminShell";
import { ToastProvider } from "@/components/admin/Toast";
import { navigationFor } from "@/lib/admin-nav";
import { hasPermission, type Permission } from "@/lib/permissions";

/**
 * Admin shell.
 *
 * The middleware has already checked the JWT, but a JWT keeps whatever role
 * it was minted with: disabling an account or demoting someone would not take
 * effect until their token expired. So the account is re-read here on every
 * admin page load, and the navigation, quick-create menu and search shortcuts
 * are all built from the role in the database rather than the one in the
 * cookie.
 */

/**
 * What the + button offers, by the permission each one needs.
 *
 * There is no "Booking" entry: a booking is created by the public checkout,
 * against a package, dates, pricing and a payment. Offering a one-click
 * create for it here would either need a whole workflow behind it or would
 * write a half-formed record — so the CRM path is Lead → Quotation instead.
 */
const CREATE_ACTIONS = [
  { label: "Lead", href: "/admin/leads?new=1", group: "CRM", permission: "leads:create" },
  { label: "Quotation", href: "/admin/quotations/new", group: "CRM", permission: "documents:create" },
  { label: "Package", href: "/admin/packages/new", group: "Travel", permission: "packages:create" },
  { label: "Destination", href: "/admin/destinations/new", group: "Travel", permission: "destinations:create" },
  { label: "Page", href: "/admin/pages", group: "Content", permission: "pages:create" },
  { label: "Blog post", href: "/admin/blogs/new", group: "Content", permission: "blogs:create" },
] as const satisfies readonly { label: string; href: string; group: string; permission: Permission }[];

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/admin/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });

  if (!user || !user.isActive) {
    // The account was disabled or deleted while the session was still valid.
    await signOut({ redirect: false });
    redirect("/admin/login?reason=account-disabled");
  }

  const quickCreate = CREATE_ACTIONS.filter((action) =>
    hasPermission(user.role, action.permission),
  ).map(({ label, href, group }) => ({ label, href, group }));

  // The palette's "Go to" results come from the same filtered navigation the
  // sidebar renders, so it can never offer a page the user cannot open.
  const shortcuts = navigationFor(user.role).flatMap((group) =>
    group.items.map((item) => ({
      label: item.label,
      href: item.href,
      group: group.label ?? "Main",
    })),
  );

  return (
    <ToastProvider>
      <AdminShell
        userName={user.name || "Admin"}
        userEmail={user.email ?? ""}
        userRole={user.role}
        quickCreate={quickCreate}
        shortcuts={shortcuts}
      >
        {children}
      </AdminShell>
    </ToastProvider>
  );
}
