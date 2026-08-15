import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { toCsv, toExcel, exportFileName, EXPORT_CONTENT_TYPE } from "@/lib/export";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const ADMIN_ONLY = ["SUPER_ADMIN", "ADMIN"];

function fmtDate(d: Date | null): string {
  return d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "";
}

function fmtDateTime(d: Date | null): string {
  return d ? new Date(d).toLocaleString("en-IN") : "";
}

/**
 * Download leads as CSV or Excel.
 * Only SUPER_ADMIN and ADMIN — lead lists are the most sensitive data here.
 *
 * /api/admin/export/leads?format=csv&from=2026-01-01&to=2026-01-31&status=NEW&owner=<userId>
 */
export async function GET(request: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || !role || !ADMIN_ONLY.includes(role)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "excel" ? "excel" : "csv";
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const status = url.searchParams.get("status");
  const owner = url.searchParams.get("owner");

  const where: Prisma.LeadWhereInput = {};

  if (from || to) {
    const gte = from ? new Date(`${from}T00:00:00`) : undefined;
    const lte = to ? new Date(`${to}T23:59:59.999`) : undefined;
    if ((gte && Number.isNaN(gte.getTime())) || (lte && Number.isNaN(lte.getTime()))) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }
    where.createdAt = { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) };
  }
  if (status) where.status = status;
  if (owner === "none") where.assignedToId = null;
  else if (owner) where.assignedToId = owner;

  const leads = await prisma.lead.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      assignedTo: { select: { name: true } },
      notes: { orderBy: { createdAt: "desc" } },
    },
  });

  const headers = [
    "Enquiry date",
    "Name",
    "Phone",
    "Email",
    "WhatsApp",
    "Destination",
    "Travel date",
    "Travellers",
    "Budget",
    "Status",
    "Assigned to",
    "Next follow-up",
    "Emails sent",
    "Calls logged",
    "Total activity",
    "Last activity",
    "Source",
    "Message",
  ];

  const rows = leads.map((l) => [
    fmtDate(l.createdAt),
    l.name,
    l.phone,
    l.email ?? "",
    l.whatsapp ?? "",
    l.destination ?? "",
    fmtDate(l.travelDate),
    l.travellers ?? "",
    l.budget ?? "",
    l.status.replace(/_/g, " "),
    l.assignedTo?.name ?? "Unassigned",
    fmtDate(l.nextFollowUpAt),
    l.notes.filter((n) => n.type === "EMAIL").length,
    l.notes.filter((n) => n.type === "CALL").length,
    l.notes.length,
    l.notes[0] ? fmtDateTime(l.notes[0].createdAt) : "",
    l.source,
    (l.message ?? "").replace(/\s+/g, " ").slice(0, 500),
  ]);

  const body = format === "excel" ? toExcel("Leads", headers, rows) : toCsv(headers, rows);
  const fileName = exportFileName(`leads${from ? `-${from}` : ""}${to ? `-to-${to}` : ""}`, format);

  return new NextResponse(body, {
    headers: {
      "Content-Type": EXPORT_CONTENT_TYPE[format],
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
