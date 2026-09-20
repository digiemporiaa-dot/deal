import Link from "next/link";
import { Plus, FileText, Mail, Printer } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader, Card, EmptyState, AdminButtonLink } from "@/components/admin/ui";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { computeTotals, DOC_LABEL, DOC_STATUSES, STATUS_TONE, type DocKind } from "@/lib/documents";

export async function DocumentList({
  kind,
  status,
  q,
}: {
  kind: DocKind;
  status?: string;
  q?: string;
}) {
  const label = DOC_LABEL[kind];
  const isInvoice = kind === "INVOICE";

  const docs = await prisma.salesDocument.findMany({
    where: {
      kind,
      ...(status ? { status } : {}),
      ...(q
        ? { OR: [{ customerName: { contains: q } }, { number: { contains: q } }, { destination: { contains: q } }] }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });

  const rows = docs.map((doc) => {
    const totals = computeTotals(
      doc.items.map((i) => ({ title: i.title, quantity: i.quantity, unitPrice: Number(i.unitPrice) })),
      { discount: Number(doc.discount), taxPercent: Number(doc.taxPercent), amountPaid: Number(doc.amountPaid) },
    );
    return { doc, totals };
  });

  const outstanding = rows.reduce((sum, r) => (isInvoice ? sum + r.totals.balance : sum), 0);
  const value = rows.reduce((sum, r) => sum + r.totals.total, 0);

  return (
    <div>
      <PageHeader
        title={label.many}
        description={
          isInvoice
            ? "Raise invoices, record payments and track what is still owed"
            : "Send professional quotations to customers and turn them into bookings"
        }
        action={
          <AdminButtonLink href={`/admin/${label.route}/new`}>
            <Plus className="h-4 w-4" /> New {label.one.toLowerCase()}
          </AdminButtonLink>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-admin-text-muted">Total {label.many.toLowerCase()}</p>
          <p className="mt-1 text-2xl font-bold text-admin-text">{docs.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-admin-text-muted">Value</p>
          <p className="mt-1 text-2xl font-bold text-admin-text">{formatCurrency(value)}</p>
        </Card>
        {isInvoice && (
          <Card className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-admin-text-muted">Outstanding</p>
            <p className={`mt-1 text-2xl font-bold ${outstanding > 0 ? "text-red-600" : "text-emerald-600"}`}>
              {formatCurrency(outstanding)}
            </p>
          </Card>
        )}
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-admin-text-muted">
            {isInvoice ? "Paid" : "Accepted"}
          </p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">
            {docs.filter((d) => (isInvoice ? d.status === "PAID" : d.status === "ACCEPTED")).length}
          </p>
        </Card>
      </div>

      <Card className="mb-4 p-3">
        <form className="flex flex-wrap gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search number, customer, destination…"
            className="h-10 min-w-[220px] flex-1 rounded-lg border border-admin-border-strong px-3 text-sm focus:border-brand-500 focus:outline-none"
          />
          <select name="status" defaultValue={status} className="h-10 rounded-lg border border-admin-border-strong px-3 text-sm">
            <option value="">All statuses</option>
            {DOC_STATUSES[kind].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button className="h-10 rounded-lg bg-admin-navy px-4 text-sm font-semibold text-white hover:bg-admin-navy-soft">
            Filter
          </button>
        </form>
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          title={`No ${label.many.toLowerCase()} yet`}
          description={`Create your first ${label.one.toLowerCase()} — or generate one straight from a lead.`}
          action={
            <AdminButtonLink href={`/admin/${label.route}/new`}>
              <Plus className="h-4 w-4" /> New {label.one.toLowerCase()}
            </AdminButtonLink>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="border-b border-admin bg-admin-bg text-left text-xs uppercase tracking-wide text-admin-text-muted">
                <tr>
                  <th className="px-4 py-3">Number</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  {isInvoice && <th className="px-4 py-3 text-right">Balance</th>}
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-border">
                {rows.map(({ doc, totals }) => (
                  <tr key={doc.id} className="hover:bg-admin-bg">
                    <td className="px-4 py-3">
                      <Link href={`/admin/${label.route}/${doc.id}`} className="inline-flex items-center gap-1.5 font-semibold text-brand-600 hover:underline">
                        <FileText className="h-4 w-4" /> {doc.number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-admin-text">{doc.customerName}</span>
                      {doc.destination && <span className="block text-xs text-admin-text-muted">{doc.destination}</span>}
                    </td>
                    <td className="px-4 py-3 text-admin-text-muted">{formatDate(doc.createdAt)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-admin-text">{formatCurrency(totals.total)}</td>
                    {isInvoice && (
                      <td className={`px-4 py-3 text-right font-semibold ${totals.balance > 0 ? "text-red-600" : "text-emerald-600"}`}>
                        {formatCurrency(totals.balance)}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONE[doc.status] ?? "slate"}>{doc.status}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/admin/${label.route}/${doc.id}/print`} target="_blank" title="Print / save as PDF" className="rounded-md p-2 text-admin-text-subtle hover:bg-admin-muted hover:text-admin-text">
                          <Printer className="h-4 w-4" />
                        </Link>
                        <Link href={`/admin/${label.route}/${doc.id}`} title="Open" className="rounded-md p-2 text-admin-text-subtle hover:bg-admin-muted hover:text-admin-text">
                          <Mail className="h-4 w-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
