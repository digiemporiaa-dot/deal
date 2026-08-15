import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { toCsv, toExcel, exportFileName, EXPORT_CONTENT_TYPE } from "@/lib/export";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ADMIN_ONLY = ["SUPER_ADMIN", "ADMIN"];

function fmtDate(d: Date | null): string {
  return d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "";
}

/**
 * Download a copy of the business data.
 *
 *  ?type=backup            -> everything, as JSON (keep this somewhere safe)
 *  ?type=bookings|customers|packages&format=csv|excel
 *
 * Passwords and payment credentials are never included.
 */
export async function GET(request: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || !role || !ADMIN_ONLY.includes(role)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "backup";
  const format = url.searchParams.get("format") === "excel" ? "excel" : "csv";

  /* ---------------- Full JSON backup ---------------- */
  if (type === "backup") {
    const [packages, destinations, pages, blogPosts, bookings, customers, leads, testimonials, coupons, documents, redirects] =
      await Promise.all([
        prisma.travelPackage.findMany({ include: { itinerary: true } }),
        prisma.destination.findMany(),
        prisma.page.findMany({ include: { faqs: true } }),
        prisma.blogPost.findMany(),
        prisma.booking.findMany({ include: { customer: true } }),
        prisma.customer.findMany(),
        prisma.lead.findMany({ include: { notes: true } }),
        prisma.testimonial.findMany(),
        prisma.coupon.findMany(),
        prisma.salesDocument.findMany({ include: { items: true } }),
        prisma.redirect.findMany(),
      ]);

    const payload = {
      exportedAt: new Date().toISOString(),
      exportedBy: session.user.email ?? session.user.name ?? "admin",
      note: "Vacation Deal data backup. Keep this file private — it contains customer information.",
      counts: {
        packages: packages.length,
        destinations: destinations.length,
        pages: pages.length,
        blogPosts: blogPosts.length,
        bookings: bookings.length,
        customers: customers.length,
        leads: leads.length,
        testimonials: testimonials.length,
        coupons: coupons.length,
        documents: documents.length,
        redirects: redirects.length,
      },
      data: { packages, destinations, pages, blogPosts, bookings, customers, leads, testimonials, coupons, documents, redirects },
    };

    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": EXPORT_CONTENT_TYPE.json,
        "Content-Disposition": `attachment; filename="${exportFileName("vacationdeal-backup", "json")}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  /* ---------------- Spreadsheet exports ---------------- */
  let headers: string[] = [];
  let rows: unknown[][] = [];
  let title = type;

  if (type === "bookings") {
    const bookings = await prisma.booking.findMany({
      orderBy: { createdAt: "desc" },
      include: { customer: true, package: { select: { name: true } } },
    });
    title = "Bookings";
    headers = ["Booking no.", "Date", "Customer", "Phone", "Email", "Package", "Travel date", "Adults", "Children", "Rooms", "Total", "Advance paid", "Balance", "Coupon", "Payment status", "Status"];
    rows = bookings.map((b) => [
      b.bookingNumber,
      fmtDate(b.createdAt),
      b.customer?.name ?? "",
      b.customer?.phone ?? "",
      b.customer?.email ?? "",
      b.package?.name ?? "",
      fmtDate(b.travelDate),
      b.adults,
      b.children,
      b.rooms,
      Number(b.totalAmount),
      Number(b.advanceAmount),
      Number(b.remainingAmount),
      b.couponCode ?? "",
      b.paymentStatus,
      b.status,
    ]);
  } else if (type === "customers") {
    const customers = await prisma.customer.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { bookings: true } } },
    });
    title = "Customers";
    headers = ["Joined", "Name", "Phone", "Email", "WhatsApp", "City", "Country", "Bookings"];
    rows = customers.map((c) => [
      fmtDate(c.createdAt),
      c.name,
      c.phone,
      c.email,
      c.whatsapp ?? "",
      c.city ?? "",
      c.country ?? "",
      c._count.bookings,
    ]);
  } else if (type === "packages") {
    const packages = await prisma.travelPackage.findMany({
      orderBy: { name: "asc" },
      include: { destination: { select: { name: true } } },
    });
    title = "Packages";
    headers = ["Name", "Destination", "Days", "Nights", "Starting price", "Discount price", "Currency", "Published", "Featured"];
    rows = packages.map((p) => [
      p.name,
      p.destination?.name ?? "",
      p.durationDays,
      p.durationNights,
      Number(p.startingPrice),
      p.discountPrice ? Number(p.discountPrice) : "",
      p.currency,
      p.published ? "Yes" : "No",
      p.featured ? "Yes" : "No",
    ]);
  } else {
    return NextResponse.json({ error: "Unknown export type" }, { status: 400 });
  }

  const body = format === "excel" ? toExcel(title, headers, rows) : toCsv(headers, rows);
  return new NextResponse(body, {
    headers: {
      "Content-Type": EXPORT_CONTENT_TYPE[format],
      "Content-Disposition": `attachment; filename="${exportFileName(type, format)}"`,
      "Cache-Control": "no-store",
    },
  });
}
