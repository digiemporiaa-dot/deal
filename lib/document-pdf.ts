import "server-only";
import PDFDocument from "pdfkit";
import { computeTotals, DOC_LABEL, type DocKind } from "@/lib/documents";
import { toNumber } from "@/lib/utils";

/**
 * Invoices and quotations as real PDFs, built on the server.
 *
 * The admin could already print one document at a time through the browser.
 * An accounts team closing a quarter needs the whole book at once, and a
 * browser print dialog does not do that, so the file is generated here.
 *
 * Amounts are written with the ISO currency code — "INR 1,94,250.00" — not
 * the ₹ sign. The standard PDF fonts are WinAnsi-encoded and have no glyph
 * for U+20B9: rendering it produces a stray superscript mark where the
 * currency should be, which was checked rather than assumed. Shipping a font
 * that has the glyph would fix ₹ alone; the code fixes every currency a
 * document can be raised in, and is what an accountant expects to see on a
 * document that may cross a border.
 */

type PdfItem = { title: string; description: string | null; quantity: number; unitPrice: number };

export type PdfDocumentData = {
  kind: string;
  number: string;
  status: string;
  createdAt: Date;
  dueDate: Date | null;
  validUntil: Date | null;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  billingAddress: string | null;
  title: string | null;
  destination: string | null;
  travelDate: Date | null;
  travellers: number | null;
  currency: string;
  discount: number;
  taxPercent: number;
  amountPaid: number;
  notes: string | null;
  terms: string | null;
  items: PdfItem[];
};

export type PdfBrand = {
  siteName: string;
  address?: string;
  phone?: string;
  email?: string;
};

const PAGE = { size: "A4" as const, margin: 48 };
const COL = { item: 250, qty: 50, unit: 95, total: 104 };

function money(amount: number, currency: string): string {
  const text = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    currencyDisplay: "code",
    minimumFractionDigits: 2,
  }).format(amount);
  // Intl separates the code with a non-breaking space; a normal one keeps the
  // encoder on entirely ordinary ground.
  return text.replace(/ /g, " ");
}

function date(value: Date | null): string {
  return value
    ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "—";
}

/** Draw one document, starting at the current page. */
function drawDocument(pdf: PDFKit.PDFDocument, doc: PdfDocumentData, brand: PdfBrand): void {
  const label = DOC_LABEL[(doc.kind as DocKind) in DOC_LABEL ? (doc.kind as DocKind) : "INVOICE"];
  const left = PAGE.margin;
  const right = pdf.page.width - PAGE.margin;
  const width = right - left;

  const totals = computeTotals(
    doc.items.map((i) => ({ title: i.title, quantity: i.quantity, unitPrice: i.unitPrice })),
    { discount: doc.discount, taxPercent: doc.taxPercent, amountPaid: doc.amountPaid },
  );

  /* ── letterhead ── */
  pdf.fillColor("#0f172a").font("Helvetica-Bold").fontSize(18).text(brand.siteName, left, PAGE.margin);
  const contact = [brand.address, brand.phone ? `Phone: ${brand.phone}` : "", brand.email]
    .filter(Boolean)
    .join("\n");
  if (contact) {
    pdf.font("Helvetica").fontSize(8.5).fillColor("#475569").text(contact, left, pdf.y + 2, { width: 260 });
  }

  const headTop = PAGE.margin;
  pdf.font("Helvetica-Bold").fontSize(22).fillColor("#1b70f1")
    .text(label.one.toUpperCase(), left, headTop, { width, align: "right" });
  pdf.font("Helvetica-Bold").fontSize(11).fillColor("#0f172a")
    .text(doc.number, left, pdf.y + 1, { width, align: "right" });
  pdf.font("Helvetica").fontSize(8.5).fillColor("#475569")
    .text(`Status: ${doc.status}`, left, pdf.y + 1, { width, align: "right" })
    .text(`Issued: ${date(doc.createdAt)}`, left, pdf.y, { width, align: "right" });
  if (doc.dueDate) pdf.text(`Due: ${date(doc.dueDate)}`, left, pdf.y, { width, align: "right" });
  if (doc.validUntil) pdf.text(`Valid until: ${date(doc.validUntil)}`, left, pdf.y, { width, align: "right" });

  let y = Math.max(pdf.y, 150) + 14;
  pdf.moveTo(left, y).lineTo(right, y).lineWidth(1.5).strokeColor("#0f172a").stroke();
  y += 16;

  /* ── who and what ── */
  pdf.font("Helvetica-Bold").fontSize(8).fillColor("#64748b").text("BILL TO", left, y);
  pdf.font("Helvetica-Bold").fontSize(11).fillColor("#0f172a").text(doc.customerName, left, pdf.y + 2, { width: 250 });
  const who = [doc.customerEmail, doc.customerPhone, doc.billingAddress].filter(Boolean).join("\n");
  if (who) pdf.font("Helvetica").fontSize(9).fillColor("#475569").text(who, left, pdf.y + 1, { width: 250 });
  const afterWho = pdf.y;

  const trip = [
    doc.title ? ["Reference", doc.title] : null,
    doc.destination ? ["Destination", doc.destination] : null,
    doc.travelDate ? ["Travel date", date(doc.travelDate)] : null,
    doc.travellers ? ["Travellers", String(doc.travellers)] : null,
  ].filter(Boolean) as [string, string][];

  if (trip.length > 0) {
    let ty = y;
    pdf.font("Helvetica-Bold").fontSize(8).fillColor("#64748b").text("TRIP", left + 280, ty);
    ty = pdf.y + 2;
    for (const [k, v] of trip) {
      pdf.font("Helvetica").fontSize(9).fillColor("#64748b").text(k, left + 280, ty, { width: 90 });
      pdf.font("Helvetica-Bold").fontSize(9).fillColor("#0f172a")
        .text(v, left + 280, ty, { width: width - 280, align: "right" });
      ty += 13;
    }
    y = Math.max(afterWho, ty);
  } else {
    y = afterWho;
  }
  y += 18;

  /* ── line items ── */
  const drawHead = (top: number) => {
    pdf.rect(left, top, width, 20).fillColor("#0f172a").fill();
    pdf.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8.5);
    pdf.text("DESCRIPTION", left + 8, top + 6, { width: COL.item });
    pdf.text("QTY", left + 8 + COL.item, top + 6, { width: COL.qty, align: "right" });
    pdf.text("RATE", left + 8 + COL.item + COL.qty, top + 6, { width: COL.unit, align: "right" });
    pdf.text("AMOUNT", left + 8 + COL.item + COL.qty + COL.unit, top + 6, { width: COL.total - 16, align: "right" });
    return top + 20;
  };

  y = drawHead(y);

  if (doc.items.length === 0) {
    pdf.font("Helvetica-Oblique").fontSize(9).fillColor("#94a3b8").text("No line items", left + 8, y + 8);
    y += 28;
  }

  for (const item of doc.items) {
    // Start a new page before a row that would run off this one.
    if (y > pdf.page.height - 200) {
      pdf.addPage();
      y = drawHead(PAGE.margin);
    }
    const lineTotal = item.quantity * item.unitPrice;
    const rowTop = y + 6;
    pdf.font("Helvetica-Bold").fontSize(9.5).fillColor("#0f172a")
      .text(item.title, left + 8, rowTop, { width: COL.item });
    if (item.description) {
      pdf.font("Helvetica").fontSize(8).fillColor("#64748b")
        .text(item.description, left + 8, pdf.y + 1, { width: COL.item });
    }
    const rowBottom = pdf.y;
    pdf.font("Helvetica").fontSize(9.5).fillColor("#0f172a");
    pdf.text(String(item.quantity), left + 8 + COL.item, rowTop, { width: COL.qty, align: "right" });
    pdf.text(money(item.unitPrice, doc.currency), left + 8 + COL.item + COL.qty, rowTop, { width: COL.unit, align: "right" });
    pdf.font("Helvetica-Bold").text(money(lineTotal, doc.currency), left + 8 + COL.item + COL.qty + COL.unit, rowTop, { width: COL.total - 16, align: "right" });

    y = Math.max(rowBottom, rowTop + 12) + 6;
    pdf.moveTo(left, y).lineTo(right, y).lineWidth(0.5).strokeColor("#e2e8f0").stroke();
  }

  /* ── totals ── */
  if (y > pdf.page.height - 190) {
    pdf.addPage();
    y = PAGE.margin;
  }
  y += 12;
  const boxLeft = left + width - 250;
  const line = (labelText: string, value: string, bold = false, colour = "#0f172a") => {
    pdf.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 10.5 : 9.5).fillColor(colour);
    pdf.text(labelText, boxLeft, y, { width: 120 });
    pdf.text(value, boxLeft + 120, y, { width: 130, align: "right" });
    y += bold ? 17 : 14;
  };

  line("Subtotal", money(totals.subtotal, doc.currency));
  if (totals.discount > 0) line("Discount", `- ${money(totals.discount, doc.currency)}`);
  if (totals.taxPercent > 0) line(`Tax (${totals.taxPercent}%)`, money(totals.taxAmount, doc.currency));

  pdf.moveTo(boxLeft, y + 1).lineTo(right, y + 1).lineWidth(1).strokeColor("#0f172a").stroke();
  y += 8;
  line("Total", money(totals.total, doc.currency), true);

  if (totals.amountPaid > 0) {
    line("Paid", `- ${money(totals.amountPaid, doc.currency)}`, false, "#16a34a");
    line("Balance due", money(totals.balance, doc.currency), true, totals.balance > 0 ? "#dc2626" : "#16a34a");
  }

  /* ── small print ── */
  y += 10;
  for (const [heading, body] of [["Notes", doc.notes], ["Terms", doc.terms]] as const) {
    if (!body) continue;
    if (y > pdf.page.height - 120) {
      pdf.addPage();
      y = PAGE.margin;
    }
    pdf.font("Helvetica-Bold").fontSize(8).fillColor("#64748b").text(heading.toUpperCase(), left, y);
    pdf.font("Helvetica").fontSize(9).fillColor("#334155").text(body, left, pdf.y + 2, { width: width - 200 });
    y = pdf.y + 10;
  }

  pdf.font("Helvetica").fontSize(8).fillColor("#94a3b8")
    .text(`${brand.siteName} · ${label.one} ${doc.number}`, left, pdf.page.height - PAGE.margin - 10, {
      width,
      align: "center",
    });
}

function finish(pdf: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    pdf.on("data", (chunk: Buffer) => chunks.push(chunk));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);
    pdf.end();
  });
}

/** One document as its own PDF. */
export function renderDocumentPdf(doc: PdfDocumentData, brand: PdfBrand): Promise<Buffer> {
  const pdf = new PDFDocument({ ...PAGE, info: { Title: doc.number, Author: brand.siteName } });
  drawDocument(pdf, doc, brand);
  return finish(pdf);
}

/** Many documents in one file, each starting on a fresh page. */
export function renderDocumentsPdf(docs: PdfDocumentData[], brand: PdfBrand): Promise<Buffer> {
  const pdf = new PDFDocument({ ...PAGE, info: { Title: `${brand.siteName} documents`, Author: brand.siteName } });
  docs.forEach((doc, index) => {
    if (index > 0) pdf.addPage();
    drawDocument(pdf, doc, brand);
  });
  if (docs.length === 0) {
    pdf.font("Helvetica").fontSize(12).fillColor("#64748b")
      .text("No documents matched those filters.", PAGE.margin, PAGE.margin);
  }
  return finish(pdf);
}
