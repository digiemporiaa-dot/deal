import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader, Card } from "@/components/admin/ui";
import { Badge } from "@/components/ui/Badge";
import { LeadStatusSelect } from "@/components/admin/LeadStatusSelect";
import { LeadTimeline } from "@/components/admin/LeadTimeline";
import { LeadEmailForm } from "@/components/admin/LeadEmailForm";
import { LeadFollowUp } from "@/components/admin/LeadFollowUp";
import { LeadAssignSelect } from "@/components/admin/LeadAssignSelect";
import { formatDate } from "@/lib/utils";
import { buildWhatsAppLink } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [lead, members] = await Promise.all([
    prisma.lead.findUnique({
      where: { id },
      include: {
        notes: { orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } } },
        assignedTo: { select: { id: true, name: true } },
      },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
  ]);
  if (!lead) notFound();

  const emailCount = lead.notes.filter((n) => n.type === "EMAIL").length;
  const callCount = lead.notes.filter((n) => n.type === "CALL").length;
  const lastTouch = lead.notes[0]?.createdAt ?? null;

  return (
    <div>
      <Link href="/admin/leads" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Back to leads
      </Link>
      <PageHeader
        title={lead.name}
        description={`Enquiry received ${formatDate(lead.createdAt)}`}
        action={<LeadStatusSelect id={lead.id} value={lead.status} />}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <Card className="p-5">
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
                <a
                  href={buildWhatsAppLink(lead.whatsapp, `Hi ${lead.name}, thank you for your enquiry with Vacationdeal.`)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center rounded-lg bg-[#25D366] px-3 text-sm font-medium text-white"
                >
                  WhatsApp
                </a>
              )}
              <Badge tone="brand">{lead.status.replace(/_/g, " ")}</Badge>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 font-semibold text-slate-900">Assigned to</h2>
            <LeadAssignSelect leadId={lead.id} value={lead.assignedToId} members={members} className="w-full" />
            <p className="mt-2 text-xs text-slate-500">
              {lead.assignedTo ? `${lead.assignedTo.name} is responsible for this lead.` : "Nobody is responsible for this lead yet."}
            </p>
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 font-semibold text-slate-900">Next follow-up</h2>
            <LeadFollowUp leadId={lead.id} current={lead.nextFollowUpAt ? lead.nextFollowUpAt.toISOString() : null} />
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 font-semibold text-slate-900">Engagement</h2>
            <dl className="space-y-2 text-sm">
              <Detail label="Emails sent" value={String(emailCount)} />
              <Detail label="Calls logged" value={String(callCount)} />
              <Detail label="Last activity" value={lastTouch ? formatDate(lastTouch) : "None yet"} />
            </dl>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card className="p-5">
            <h2 className="mb-3 font-semibold text-slate-900">Send an email</h2>
            <LeadEmailForm leadId={lead.id} leadEmail={lead.email} />
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 font-semibold text-slate-900">Activity timeline</h2>
            <LeadTimeline
              leadId={lead.id}
              items={lead.notes.map((n) => ({
                id: n.id,
                type: n.type,
                body: n.body,
                subject: n.subject,
                emailTo: n.emailTo,
                delivered: n.delivered,
                createdAt: n.createdAt.toISOString(),
                author: n.author?.name ?? null,
              }))}
            />
          </Card>
        </div>
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
