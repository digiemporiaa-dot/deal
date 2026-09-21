/**
 * Quotation and invoice vocabulary, without the database.
 *
 * `lib/documents.ts` is `server-only` because it reaches for Prisma to mint
 * document numbers. These constants carry no such dependency, and the admin
 * screens that render a document — the lead drawer among them — are client
 * components. Splitting them out lets both sides share one definition of what
 * an invoice is called and what colour a status is, rather than keeping a
 * second copy on the client that drifts.
 */

export type DocKind = "QUOTATION" | "INVOICE";

export const DOC_LABEL: Record<DocKind, { one: string; many: string; prefix: string; route: string }> = {
  QUOTATION: { one: "Quotation", many: "Quotations", prefix: "QT", route: "quotations" },
  INVOICE: { one: "Invoice", many: "Invoices", prefix: "INV", route: "invoices" },
};

export const DOC_STATUSES: Record<DocKind, string[]> = {
  QUOTATION: ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"],
  INVOICE: ["DRAFT", "SENT", "PARTIAL", "PAID", "CANCELLED"],
};

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

/** The stored `kind` is a plain string, so these tolerate an unknown one. */
export function docRoute(kind: string): string {
  return DOC_LABEL[kind as DocKind]?.route ?? "quotations";
}

export function docLabel(kind: string): string {
  return DOC_LABEL[kind as DocKind]?.one ?? "Document";
}
