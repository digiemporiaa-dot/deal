import { PageHeader } from "@/components/admin/ui";
import { DocumentForm } from "@/components/admin/DocumentForm";
import { DOC_LABEL, DOC_STATUSES, type DocKind } from "@/lib/documents";

export const dynamic = "force-dynamic";

const KIND: DocKind = "INVOICE";

export default function NewDocumentPage() {
  const label = DOC_LABEL[KIND];
  return (
    <div>
      <PageHeader title={`New ${label.one.toLowerCase()}`} description={`Build a ${label.one.toLowerCase()} line by line — totals update as you type`} />
      <DocumentForm
        statuses={DOC_STATUSES[KIND]}
        initial={{
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
        }}
      />
    </div>
  );
}
