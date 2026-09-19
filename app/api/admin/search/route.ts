import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/guard";
import { hasPermission, isLeadOwnerOnly } from "@/lib/permissions";
import { toSafeError } from "@/lib/errors";

/**
 * Global search behind the command palette.
 *
 * Every group is gated on the caller's own permissions and re-checked here —
 * the palette is a convenience, not a way around the permission matrix. A
 * sales executive who may only see their own leads gets only their own leads
 * back, exactly as the leads list would give them.
 *
 * Results are capped hard: this runs on every few keystrokes, and nobody
 * scrolls a command palette.
 */

const PER_GROUP = 5;

export type SearchHit = {
  id: string;
  group: string;
  title: string;
  subtitle: string;
  href: string;
};

export async function GET(request: Request) {
  const actor = await currentUser();
  if (!actor) return NextResponse.json({ hits: [] }, { status: 401 });

  const term = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (term.length < 2) return NextResponse.json({ hits: [] });

  // Bound the term so a pathological string cannot reach the database.
  const q = term.slice(0, 80);
  const contains = { contains: q, mode: "insensitive" as const };

  try {
    const hits: SearchHit[] = [];

    const tasks: Promise<void>[] = [];

    if (hasPermission(actor.role, "leads:view")) {
      tasks.push(
        prisma.lead
          .findMany({
            where: {
              AND: [
                isLeadOwnerOnly(actor.role) ? { assignedToId: actor.id } : {},
                { OR: [{ name: contains }, { email: contains }, { phone: contains }, { destination: contains }] },
              ],
            },
            select: { id: true, name: true, email: true, phone: true, destination: true, status: true },
            orderBy: { createdAt: "desc" },
            take: PER_GROUP,
          })
          .then((rows) => {
            for (const row of rows) {
              hits.push({
                id: `lead-${row.id}`,
                group: "Leads",
                title: row.name,
                subtitle: [row.email || row.phone, row.destination].filter(Boolean).join(" · "),
                href: `/admin/leads?lead=${row.id}`,
              });
            }
          }),
      );
    }

    if (hasPermission(actor.role, "customers:view")) {
      tasks.push(
        prisma.customer
          .findMany({
            where: { OR: [{ name: contains }, { email: contains }, { phone: contains }] },
            select: { id: true, name: true, email: true, phone: true },
            orderBy: { createdAt: "desc" },
            take: PER_GROUP,
          })
          .then((rows) => {
            for (const row of rows) {
              hits.push({
                id: `customer-${row.id}`,
                group: "Customers",
                title: row.name,
                subtitle: [row.email, row.phone].filter(Boolean).join(" · "),
                href: `/admin/customers?customer=${row.id}`,
              });
            }
          }),
      );
    }

    if (hasPermission(actor.role, "bookings:view")) {
      tasks.push(
        prisma.booking
          .findMany({
            where: {
              OR: [
                { bookingNumber: contains },
                { customer: { name: contains } },
                { customer: { email: contains } },
                { package: { name: contains } },
              ],
            },
            select: {
              id: true,
              bookingNumber: true,
              status: true,
              customer: { select: { name: true } },
              package: { select: { name: true } },
            },
            orderBy: { createdAt: "desc" },
            take: PER_GROUP,
          })
          .then((rows) => {
            for (const row of rows) {
              hits.push({
                id: `booking-${row.id}`,
                group: "Bookings",
                title: row.bookingNumber,
                subtitle: `${row.customer.name} · ${row.package.name}`,
                href: `/admin/bookings?booking=${row.id}`,
              });
            }
          }),
      );
    }

    if (hasPermission(actor.role, "packages:view")) {
      tasks.push(
        prisma.travelPackage
          .findMany({
            where: { OR: [{ name: contains }, { slug: contains }] },
            select: { id: true, name: true, destination: { select: { name: true } }, published: true },
            orderBy: { updatedAt: "desc" },
            take: PER_GROUP,
          })
          .then((rows) => {
            for (const row of rows) {
              hits.push({
                id: `package-${row.id}`,
                group: "Packages",
                title: row.name,
                subtitle: `${row.destination.name}${row.published ? "" : " · Draft"}`,
                href: `/admin/packages/${row.id}/edit`,
              });
            }
          }),
      );
    }

    if (hasPermission(actor.role, "destinations:view")) {
      tasks.push(
        prisma.destination
          .findMany({
            where: { OR: [{ name: contains }, { country: contains }, { slug: contains }] },
            select: { id: true, name: true, country: true },
            orderBy: { updatedAt: "desc" },
            take: PER_GROUP,
          })
          .then((rows) => {
            for (const row of rows) {
              hits.push({
                id: `destination-${row.id}`,
                group: "Destinations",
                title: row.name,
                subtitle: row.country,
                href: `/admin/destinations/${row.id}/edit`,
              });
            }
          }),
      );
    }

    if (hasPermission(actor.role, "pages:view")) {
      tasks.push(
        prisma.page
          .findMany({
            where: { OR: [{ title: contains }, { slug: contains }] },
            select: { id: true, title: true, slug: true, status: true },
            orderBy: { updatedAt: "desc" },
            take: PER_GROUP,
          })
          .then((rows) => {
            for (const row of rows) {
              hits.push({
                id: `page-${row.id}`,
                group: "Pages",
                title: row.title,
                subtitle: `/${row.slug}${row.status === "PUBLISHED" ? "" : " · Draft"}`,
                href: `/admin/pages/${row.id}/builder`,
              });
            }
          }),
      );
    }

    if (hasPermission(actor.role, "blogs:view")) {
      tasks.push(
        prisma.blogPost
          .findMany({
            where: { OR: [{ title: contains }, { slug: contains }] },
            select: { id: true, title: true, slug: true, status: true },
            orderBy: { updatedAt: "desc" },
            take: PER_GROUP,
          })
          .then((rows) => {
            for (const row of rows) {
              hits.push({
                id: `blog-${row.id}`,
                group: "Blog",
                title: row.title,
                subtitle: `/blog/${row.slug}${row.status === "PUBLISHED" ? "" : " · Draft"}`,
                href: `/admin/blogs/${row.id}/edit`,
              });
            }
          }),
      );
    }

    await Promise.all(tasks);

    return NextResponse.json({ hits });
  } catch (error) {
    const safe = toSafeError(error, "api.adminSearch");
    return NextResponse.json({ hits: [], error: safe.message }, { status: 500 });
  }
}
