import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, ipFromRequest } from "@/lib/guard";
import { recordActivity } from "@/lib/activity";
import { toSafeError } from "@/lib/errors";
import { limitFor } from "@/lib/rate-limit";
import { toCsv, toExcel, exportFileName, EXPORT_CONTENT_TYPE } from "@/lib/export";
import { computeTotals, DOC_LABEL, DOC_STATUSES, type DocKind } from "@/lib/documents";
import { toNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Bulk download of invoices (or quotations) for an accounts team.
 *
 *   ?kind=INVOICE|QUOTATION   which book to pull; invoices by default
 *   ?from=YYYY-MM-DD          issued on or after this date
 *   ?to=YYYY-MM-DD            issued on or before this date, inclusive
 *   ?status=PAID|…            one status, or every status when omitted
 *   ?detail=summary|items     one row per document, or one row per line
 *   ?format=csv|excel
 *
 * Behind `documents:export` rather than `export:data`: this is every
 * customer's name, contact details and what they paid, which is a narrower
 * and more sensitive thing than the general backup.
 *
 * Totals are not read from the row. `discount` and `taxPercent` are stored,
 * but the total is derived, so recomputing it with the same helper the
 * document and the PDF use is what stops an export disagreeing with the
 * invoice the customer was sent.
 */

/** Parse a YYYY-MM-DD bound. `endOfDay` makes `to` inclusive of that date. */
function parseDate(value: string | null, endOfDay = false): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function fmtDate(value: Date | null): string {
  return value
    ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "";
}

export async function GET(request: Request) {
  let actor;
  try {
    actor = await requirePermission("documents:export");
  } catch (error) {
    const safe = toSafeError(error, "api.export.invoices", { ip: ipFromRequest(request) });
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }

  const throttle = limitFor("adminExport", actor.id);
  if (!throttle.ok) {
    return NextResponse.json(
      { error: "Too many exports. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(throttle.retryAfter) } },
    );
  }

  const url = new URL(request.url);
  const kind: DocKind = url.searchParams.get("kind") === "QUOTATION" ? "QUOTATION" : "INVOICE";
  const format = url.searchParams.get("format") === "excel" ? "excel" : "csv";
  const detail = url.searchParams.get("detail") === "items" ? "items" : "summary";
  const from = parseDate(url.searchParams.get("from"));
  const to = parseDate(url.searchParams.get("to"), true);

  const statusParam = url.searchParams.get("status") || "";
  const status = DOC_STATUSES[kind].includes(statusParam) ? statusParam : null;

  if (from && to && from > to) {
    return NextResponse.json({ error: "The start date is after the end date." }, { status: 400 });
  }

  const documents = await prisma.salesDocument.findMany({
    where: {
      kind,
      ...(status ? { status } : {}),
      ...(from || to
        ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}),
    },
    orderBy: { createdAt: "asc" },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      lead: { select: { name: true } },
    },
  });

  const label = DOC_LABEL[kind];
  const headers =
    detail === "items"
      ? [
          "Number", "Date", "Status", "Customer", "Email", "Phone",
          "Title", "Destination", "Item", "Description", "Qty", "Unit price", "Line total", "Currency",
        ]
      : [
          "Number", "Date", "Due date", "Status", "Customer", "Email", "Phone", "Billing address",
          "Title", "Destination", "Travel date", "Travellers",
          "Subtotal", "Discount", "Tax %", "Tax amount", "Total", "Amount paid", "Balance",
          "Currency", "From lead",
        ];

  const rows: unknown[][] = [];

  for (const doc of documents) {
    const lineItems = doc.items.map((item) => ({
      title: item.title,
      quantity: item.quantity,
      unitPrice: toNumber(item.unitPrice),
    }));
    const totals = computeTotals(lineItems, {
      discount: toNumber(doc.discount),
      taxPercent: toNumber(doc.taxPercent),
      amountPaid: toNumber(doc.amountPaid),
    });

    if (detail === "items") {
      if (doc.items.length === 0) {
        // A document with no lines still belongs in the file; leaving it out
        // would make the export disagree with the list it came from.
        rows.push([
          doc.number, fmtDate(doc.createdAt), doc.status, doc.customerName,
          doc.customerEmail ?? "", doc.customerPhone ?? "",
          doc.title ?? "", doc.destination ?? "", "(no line items)", "", "", "", "", doc.currency,
        ]);
      }
      for (const item of doc.items) {
        rows.push([
          doc.number, fmtDate(doc.createdAt), doc.status, doc.customerName,
          doc.customerEmail ?? "", doc.customerPhone ?? "",
          doc.title ?? "", doc.destination ?? "",
          item.title, item.description ?? "",
          item.quantity, toNumber(item.unitPrice),
          item.quantity * toNumber(item.unitPrice), doc.currency,
        ]);
      }
    } else {
      rows.push([
        doc.number, fmtDate(doc.createdAt), fmtDate(doc.dueDate), doc.status,
        doc.customerName, doc.customerEmail ?? "", doc.customerPhone ?? "", doc.billingAddress ?? "",
        doc.title ?? "", doc.destination ?? "", fmtDate(doc.travelDate), doc.travellers ?? "",
        totals.subtotal, totals.discount, totals.taxPercent, totals.taxAmount,
        totals.total, totals.amountPaid, totals.balance,
        doc.currency, doc.lead?.name ?? "",
      ]);
    }
  }

  const range = [from ? from.toISOString().slice(0, 10) : "", to ? to.toISOString().slice(0, 10) : ""]
    .filter(Boolean)
    .join("-to-");
  const base = [label.many.toLowerCase(), detail === "items" ? "line-items" : "", range]
    .filter(Boolean)
    .join("-");

  await recordActivity({
    actor,
    action: "EXPORT",
    entity: "SalesDocument",
    description: `Exported ${documents.length} ${label.many.toLowerCase()}`,
    metadata: {
      kind, detail, format, count: documents.length,
      from: from?.toISOString() ?? null,
      to: to?.toISOString() ?? null,
      status: status ?? "all",
    },
  });

  const body =
    format === "excel" ? toExcel(`${label.many} export`, headers, rows) : toCsv(headers, rows);

  return new NextResponse(body, {
    headers: {
      "Content-Type": EXPORT_CONTENT_TYPE[format]!,
      "Content-Disposition": `attachment; filename="${exportFileName(base, format)}"`,
      "Cache-Control": "no-store",
    },
  });
}
