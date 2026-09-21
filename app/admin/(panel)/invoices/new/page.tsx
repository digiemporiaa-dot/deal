import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/admin/ui";
import { DocumentForm } from "@/components/admin/DocumentForm";
import {
  InvoiceSourcePicker,
  type AcceptedQuotation,
  type CustomerOption,
} from "@/components/admin/InvoiceSourcePicker";
import { computeTotals, DOC_LABEL, DOC_STATUSES, type DocKind } from "@/lib/documents";
import { requirePermission } from "@/lib/guard";
import { toNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

const KIND: DocKind = "INVOICE";

const EMPTY = {
  kind: KIND,
  status: "DRAFT",
  customerName: "",
  customerEmail: "",
  customerPhone: "",
  billingAddress: "",
  title: "",
  destination: "",
  travelDate: "",
  travellers: "",
  validUntil: "",
  dueDate: "",
  discount: 0,
  taxPercent: 0,
  amountPaid: 0,
  notes: "",
  terms: "",
  items: [{ title: "", description: "", quantity: 1, unitPrice: 0 }],
};

/**
 * Starting an invoice.
 *
 * An invoice almost never begins from nothing: it bills a quotation the
 * customer accepted, or a customer already on the books. So the blank form is
 * the third option rather than the only one, and the page opens on a chooser
 * unless a source is already named in the URL.
 *
 * Converting a quotation is a server action rather than a prefilled form —
 * copying twenty line items through query parameters would be a way to lose
 * one. `?customerId=` only carries who is being billed, which is all the form
 * needs to be usefully started.
 */
export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ blank?: string; customerId?: string }>;
}) {
  await requirePermission("documents:create");
  const sp = await searchParams;
  const label = DOC_LABEL[KIND];

  if (!sp.blank && !sp.customerId) {
    const [quotationRows, customerRows] = await Promise.all([
      prisma.salesDocument.findMany({
        where: { kind: "QUOTATION", status: "ACCEPTED" },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          items: { select: { quantity: true, unitPrice: true } },
          lead: { select: { name: true } },
        },
      }),
      prisma.customer.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          _count: { select: { bookings: true } },
        },
      }),
    ]);

    const quotations: AcceptedQuotation[] = quotationRows.map((q) => ({
      id: q.id,
      number: q.number,
      customerName: q.customerName,
      title: q.title,
      destination: q.destination,
      // The same totals helper the document itself uses, so the figure on the
      // chooser is the figure on the invoice it creates.
      total: computeTotals(
        q.items.map((item) => ({
          title: "",
          quantity: item.quantity,
          unitPrice: toNumber(item.unitPrice),
        })),
        { discount: toNumber(q.discount), taxPercent: toNumber(q.taxPercent) },
      ).total,
      currency: q.currency,
      createdAt: q.createdAt.toISOString(),
      leadName: q.lead?.name ?? null,
    }));

    const customers: CustomerOption[] = customerRows.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      bookings: c._count.bookings,
    }));

    return (
      <div>
        <PageHeader
          title={`New ${label.one.toLowerCase()}`}
          description="Bill an accepted quotation, an existing customer, or start from scratch"
        />
        <InvoiceSourcePicker quotations={quotations} customers={customers} />
      </div>
    );
  }

  let initial = EMPTY;

  if (sp.customerId) {
    const customer = await prisma.customer.findUnique({
      where: { id: sp.customerId },
      select: { name: true, email: true, phone: true, city: true, country: true },
    });
    if (customer) {
      initial = {
        ...EMPTY,
        customerName: customer.name,
        customerEmail: customer.email ?? "",
        customerPhone: customer.phone ?? "",
        billingAddress: [customer.city, customer.country].filter(Boolean).join(", "),
      };
    }
  }

  return (
    <div>
      <PageHeader
        title={`New ${label.one.toLowerCase()}`}
        description={`Build a ${label.one.toLowerCase()} line by line — totals update as you type`}
      />
      <DocumentForm statuses={DOC_STATUSES[KIND]} initial={initial} />
    </div>
  );
}
