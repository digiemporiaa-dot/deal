import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader, Card } from "@/components/admin/ui";
import { Badge } from "@/components/ui/Badge";
import { LeadStatusSelect } from "@/components/admin/LeadStatusSelect";
import { LeadNotes } from "@/components/admin/LeadNotes";
import { formatDate } from "@/lib/utils";
import { buildWhatsAppLink } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: { notes: { orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } } } },
  });
  if (!lead) notFound();

  return (
    <div>
      <Link href="/admin/leads" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Back to leads
      </Link>
      <PageHeader title={lead.name} description={`Enquiry received ${formatDate(lead.createdAt)}`} action={<LeadStatusSelect id={lead.id} value={lead.status} />} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-1">
          <h2 className="mb-3 font-semibold text-slate-900">Details</h2>
          <dl className="space-y-2 text-sm">
            <Detail label="Phone" value={lead.phone} />
            <Detail label="Email" value={lead.email || "—"} />
            <Detail label="WhatsApp" value={lead.whatsapp || "—"} />
            <Detail label="Destination" value={lead.destination || "—"} />
            <Detail label="Travel date" value={lead.travelDate ? formatDate(lead.travelDate) : "—"} />
            <Detail label="Travellers" value={lead.travellers ? String(lead.travellers) : "—"} />
            <Detail label="Budget" value={lead.budget || "—"} />
            <Detail label="Source" value={lead.source} />
          </dl>
          {lead.message && (
            <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{lead.message}</div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={`tel:${lead.phone}`} className="inline-flex h-9 items-center rounded-lg border border-slate-300 px-3 text-sm font-medium hover:bg-slate-50">Call</a>
            {lead.whatsapp && (
              <a href={buildWhatsAppLink(lead.whatsapp, `Hi ${lead.name}, thank you for your enquiry with Vacationdeal.`)} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center rounded-lg bg-[#25D366] px-3 text-sm font-medium text-white">WhatsApp</a>
            )}
            <Badge tone="brand">{lead.status.replace(/_/g, " ")}</Badge>
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-3 font-semibold text-slate-900">Internal notes</h2>
          <LeadNotes
            leadId={lead.id}
            notes={lead.notes.map((n) => ({ id: n.id, body: n.body, createdAt: n.createdAt.toISOString(), author: n.author?.name ?? null }))}
          />
        </Card>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{value}</dd>
    </div>
  );
}
