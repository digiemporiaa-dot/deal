import "server-only";
import { prisma } from "@/lib/db";

export type DocKind = "QUOTATION" | "INVOICE";

export const DOC_LABEL: Record<DocKind, { one: string; many: string; prefix: string; route: string }> = {
  QUOTATION: { one: "Quotation", many: "Quotations", prefix: "QT", route: "quotations" },
  INVOICE: { one: "Invoice", many: "Invoices", prefix: "INV", route: "invoices" },
};

export const DOC_STATUSES: Record<DocKind, string[]> = {
  QUOTATION: ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"],
  INVOICE: ["DRAFT", "SENT", "PARTIAL", "PAID", "CANCELLED"],
};

export type LineItem = {
  title: string;
  description?: string | null;
  quantity: number;
  unitPrice: number;
};

export type Totals = {
  subtotal: number;
  discount: number;
  taxable: number;
  taxPercent: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  balance: number;
};

/** Single source of truth for money maths — used by forms, print views and emails. */
export function computeTotals(
  items: LineItem[],
  opts: { discount?: number; taxPercent?: number; amountPaid?: number } = {},
): Totals {
  const subtotal = items.reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
  const discount = Math.min(Math.max(Number(opts.discount) || 0, 0), subtotal);
  const taxable = subtotal - discount;
  const taxPercent = Math.max(Number(opts.taxPercent) || 0, 0);
  const taxAmount = Math.round((taxable * taxPercent) / 100);
  const total = taxable + taxAmount;
  const amountPaid = Math.max(Number(opts.amountPaid) || 0, 0);
  return {
    subtotal,
    discount,
    taxable,
    taxPercent,
    taxAmount,
    total,
    amountPaid,
    balance: Math.max(total - amountPaid, 0),
  };
}

/** Sequential, human-friendly document number: QT-2026-0007 / INV-2026-0012. */
export async function nextDocumentNumber(kind: DocKind): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `${DOC_LABEL[kind].prefix}-${year}-`;

  const latest = await prisma.salesDocument.findFirst({
    where: { kind, number: { startsWith: prefix } },
    orderBy: { number: "desc" },
    select: { number: true },
  });

  const lastSeq = latest ? Number(latest.number.slice(prefix.length)) : 0;
  const next = (Number.isFinite(lastSeq) ? lastSeq : 0) + 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

export const STATUS_TONE: Record<string, "slate" | "brand" | "green" | "amber" | "red"> = {
  DRAFT: "slate",
  SENT: "brand",
  ACCEPTED: "green",
  PAID: "green",
  PARTIAL: "amber",
  REJECTED: "red",
  EXPIRED: "red",
  CANCELLED: "red",
};
