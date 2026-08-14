import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader, Card } from "@/components/admin/ui";
import { DocumentForm } from "@/components/admin/DocumentForm";
import { DocumentActions } from "@/components/admin/DocumentActions";
import { DOC_LABEL, DOC_STATUSES, computeTotals, type DocKind } from "@/lib/documents";
import { formatCurrency } from "@/lib/utils";

function iso(d: Date | null): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}

export async function DocumentDetail({ kind, id }: { kind: DocKind; id: string }) {
  const label = DOC_LABEL[kind];
  const doc = await prisma.salesDocument.findUnique({
    where: { id },
    include: { items: { orderBy: { sortOrder: "asc" } }, lead: { select: { id: true, name: true } } },
  });
  if (!doc || doc.kind !== kind) notFound();

  const totals = computeTotals(
    doc.items.map((i) => ({ title: i.title, quantity: i.quantity, unitPrice: Number(i.unitPrice) })),
    { discount: Number(doc.discount), taxPercent: Number(doc.taxPercent), amountPaid: Number(doc.amountPaid) },
  );

  return (
    <div>
      <Link href={`/admin/${label.route}`} className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Back to {label.many.toLowerCase()}
      </Link>

      <PageHeader
        title={`${label.one} ${doc.number}`}
        description={`${doc.customerName}${doc.destination ? ` · ${doc.destination}` : ""} · ${formatCurrency(totals.total)}`}
        action={
          <Link
            href={`/admin/${label.route}/${doc.id}/print`}
            target="_blank"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Printer className="h-4 w-4" /> Print / PDF
          </Link>
        }
      />

      <Card className="mb-6 p-5">
        <DocumentActions
          id={doc.id}
          kind={kind}
          status={doc.status}
          hasEmail={Boolean(doc.customerEmail)}
          balance={totals.balance}
        />
        {doc.lead && (
          <p className="mt-3 text-sm text-slate-500">
            Created from lead{" "}
            <Link href={`/admin/leads/${doc.lead.id}`} className="font-semibold text-brand-600 hover:underline">
              {doc.lead.name}
            </Link>
          </p>
        )}
      </Card>

      <DocumentForm
        statuses={DOC_STATUSES[kind]}
        initial={{
          id: doc.id,
          kind,
          number: doc.number,
          status: doc.status,
          leadId: doc.leadId,
          customerName: doc.customerName,
          customerEmail: doc.customerEmail ?? "",
          customerPhone: doc.customerPhone ?? "",
          billingAddress: doc.billingAddress ?? "",
          title: doc.title ?? "",
          destination: doc.destination ?? "",
          travelDate: iso(doc.travelDate),
          travellers: doc.travellers ? String(doc.travellers) : "",
          validUntil: iso(doc.validUntil),
          dueDate: iso(doc.dueDate),
          discount: Number(doc.discount),
          taxPercent: Number(doc.taxPercent),
          amountPaid: Number(doc.amountPaid),
          notes: doc.notes ?? "",
          terms: doc.terms ?? "",
          items: doc.items.map((i) => ({
            title: i.title,
            description: i.description ?? "",
            quantity: i.quantity,
            unitPrice: Number(i.unitPrice),
          })),
        }}
      />
    </div>
  );
}
