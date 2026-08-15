import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { getCustomerSession } from "@/lib/customer-session";
import { getSettings } from "@/lib/settings";
import { PrintButton } from "@/components/admin/PrintButton";
import { computeTotals, DOC_LABEL, type DocKind } from "@/lib/documents";
import { formatCurrency, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Document", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CustomerDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customerId = await getCustomerSession();
  if (!customerId) notFound();

  const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { email: true } });
  if (!customer) notFound();

  const [doc, settings] = await Promise.all([
    prisma.salesDocument.findUnique({ where: { id }, include: { items: { orderBy: { sortOrder: "asc" } } } }),
    getSettings(),
  ]);

  // Customers may only open documents addressed to them, and never drafts.
  if (!doc || doc.customerEmail?.toLowerCase() !== customer.email.toLowerCase()) notFound();
  if (doc.status === "DRAFT" || doc.status === "CANCELLED") notFound();

  const kind = doc.kind as DocKind;
  const label = DOC_LABEL[kind];
  const totals = computeTotals(
    doc.items.map((i) => ({ title: i.title, quantity: i.quantity, unitPrice: Number(i.unitPrice) })),
    { discount: Number(doc.discount), taxPercent: Number(doc.taxPercent), amountPaid: Number(doc.amountPaid) },
  );

  return (
    <div className="bg-slate-100 py-8 print:bg-white print:py-0">
      <div className="mx-auto mb-4 max-w-[820px] px-4 print:hidden">
        <Link href="/my-trips" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft className="h-4 w-4" /> Back to my trips
        </Link>
        <PrintButton fileName={doc.number} />
      </div>

      <div className="mx-auto max-w-[820px] bg-white p-10 shadow-sm print:max-w-none print:p-0 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-slate-900 pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{settings.siteName}</h1>
            <div className="mt-1 space-y-0.5 text-xs text-slate-600">
              {settings.address && <p>{settings.address}</p>}
              {settings.phone && <p>Phone: {settings.phone}</p>}
              {settings.email && <p>{settings.email}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold uppercase tracking-wide text-slate-900">{label.one}</p>
            <p className="mt-1 font-mono text-sm font-semibold text-slate-700">{doc.number}</p>
            <p className="mt-1 text-xs text-slate-500">Date: {formatDate(doc.createdAt)}</p>
            {doc.dueDate && <p className="text-xs text-slate-500">Due: {formatDate(doc.dueDate)}</p>}
          </div>
        </div>

        <div className="py-6">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">Billed to</p>
          <p className="font-semibold text-slate-900">{doc.customerName}</p>
          {doc.customerPhone && <p className="text-sm text-slate-600">{doc.customerPhone}</p>}
          {doc.billingAddress && <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{doc.billingAddress}</p>}
        </div>

        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">Description</th>
              <th className="w-16 px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider">Qty</th>
              <th className="w-28 px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider">Rate</th>
              <th className="w-32 px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider">Amount</th>
            </tr>
          </thead>
          <tbody>
            {doc.items.map((item, i) => (
              <tr key={item.id} className={i % 2 ? "bg-slate-50" : ""}>
                <td className="border-b border-slate-200 px-3 py-3 align-top">
                  <p className="font-medium text-slate-900">{item.title}</p>
                  {item.description && <p className="mt-0.5 text-xs text-slate-500">{item.description}</p>}
                </td>
                <td className="border-b border-slate-200 px-3 py-3 text-center align-top text-slate-700">{item.quantity}</td>
                <td className="border-b border-slate-200 px-3 py-3 text-right align-top text-slate-700">{formatCurrency(Number(item.unitPrice))}</td>
                <td className="border-b border-slate-200 px-3 py-3 text-right align-top font-semibold text-slate-900">
                  {formatCurrency(item.quantity * Number(item.unitPrice))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 flex justify-end">
          <table className="w-72">
            <tbody>
              <tr><td className="py-1.5 text-sm text-slate-600">Subtotal</td><td className="py-1.5 text-right text-sm font-semibold">{formatCurrency(totals.subtotal)}</td></tr>
              {totals.discount > 0 && <tr><td className="py-1.5 text-sm text-slate-600">Discount</td><td className="py-1.5 text-right text-sm font-semibold text-emerald-600">− {formatCurrency(totals.discount)}</td></tr>}
              {totals.taxAmount > 0 && <tr><td className="py-1.5 text-sm text-slate-600">Tax ({totals.taxPercent}%)</td><td className="py-1.5 text-right text-sm font-semibold">{formatCurrency(totals.taxAmount)}</td></tr>}
              <tr className="border-t-2 border-slate-900"><td className="py-2.5 font-bold text-slate-900">Total</td><td className="py-2.5 text-right text-lg font-bold text-slate-900">{formatCurrency(totals.total)}</td></tr>
              {totals.amountPaid > 0 && (
                <>
                  <tr><td className="py-1.5 text-sm text-slate-600">Amount paid</td><td className="py-1.5 text-right text-sm font-semibold text-emerald-600">− {formatCurrency(totals.amountPaid)}</td></tr>
                  <tr className="border-t border-slate-300"><td className="py-2 font-bold text-slate-900">Balance due</td><td className={`py-2 text-right font-bold ${totals.balance > 0 ? "text-red-600" : "text-emerald-600"}`}>{formatCurrency(totals.balance)}</td></tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        {doc.notes && (
          <div className="mt-8 rounded-lg bg-slate-50 p-4">
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">Notes</p>
            <p className="whitespace-pre-line text-sm text-slate-700">{doc.notes}</p>
          </div>
        )}
        {doc.terms && (
          <div className="mt-4">
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">Terms &amp; conditions</p>
            <p className="whitespace-pre-line text-xs leading-relaxed text-slate-500">{doc.terms}</p>
          </div>
        )}

        <div className="mt-10 border-t border-slate-200 pt-4 text-center text-xs text-slate-400">
          Thank you for choosing {settings.siteName}
        </div>
      </div>
    </div>
  );
}
