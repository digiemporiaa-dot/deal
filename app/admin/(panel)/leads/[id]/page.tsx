import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader, Card, StatusBadge } from "@/components/admin/ui";
import { LeadStatusSelect } from "@/components/admin/LeadStatusSelect";
import { LeadTimeline } from "@/components/admin/LeadTimeline";
import { LeadEmailForm } from "@/components/admin/LeadEmailForm";
import { LeadAssignSelect } from "@/components/admin/LeadAssignSelect";
import { LeadDocumentButton } from "@/components/admin/LeadDocumentButton";
import { LeadPrioritySelect } from "@/components/admin/LeadPrioritySelect";
import { LeadScoreCard } from "@/components/admin/LeadScoreCard";
import { LeadFollowUpTasks } from "@/components/admin/LeadFollowUpTasks";
import { LeadQualificationForm } from "@/components/admin/LeadQualificationForm";
import { LeadStatusHistory } from "@/components/admin/LeadStatusHistory";
import { LeadDuplicateWarning } from "@/components/admin/LeadDuplicateWarning";
import { requirePermission, currentUser, can } from "@/lib/guard";
import { isLeadOwnerOnly, canAssignLeads } from "@/lib/permissions";
import { leadSourceLabel } from "@/lib/crm";
import { leadStatusTone } from "@/lib/admin-status";
import { leadWorkspace, leadTagOptions } from "@/lib/services/lead-workspace";
import { formatDate, dateInputValue } from "@/lib/utils";
import { buildWhatsAppLink } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePermission("leads:view");
  const actor = await currentUser();
  const role = actor?.role;
  const ownLeadsOnly = isLeadOwnerOnly(role);
  const mayAssign = canAssignLeads(role);

  // `leadWorkspace` applies the ownership rule itself and returns null for a
  // lead this user may not see, so a 404 covers both "gone" and "not yours" —
  // the same response either way, which is what stops the page confirming
  // that someone else's lead exists.
  const [workspace, mayUpdate] = await Promise.all([leadWorkspace(id, actor), can("leads:update")]);
  if (!workspace) notFound();

  const { lead, score, tags, followUps, history, duplicates, emailCount, callCount, lastTouch } =
    workspace;

  const [members, packages, destinations, tagSuggestions] = await Promise.all([
    mayAssign
      ? prisma.user.findMany({
          where: { isActive: true },
          select: { id: true, name: true, role: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([] as { id: string; name: string; role: string }[]),
    prisma.travelPackage.findMany({
      where: { published: true },
      select: { id: true, name: true, destinationId: true },
      orderBy: { name: "asc" },
      take: 300,
    }),
    prisma.destination.findMany({
      where: { isPublished: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
    leadTagOptions(actor, 12),
  ]);

  return (
    <div>
      <Link
        href="/admin/leads"
        className="mb-4 inline-flex items-center gap-1 text-sm text-admin-text-muted hover:text-admin-text"
      >
        <ArrowLeft className="h-4 w-4" /> Back to leads
      </Link>

      <PageHeader
        title={lead.name}
        description={`Enquiry received ${formatDate(lead.createdAt)}`}
        action={
          mayUpdate ? (
            <LeadStatusSelect id={lead.id} value={lead.status} />
          ) : (
            <StatusBadge tone={leadStatusTone(lead.status)}>{lead.status}</StatusBadge>
          )
        }
      />

      {duplicates.length > 0 && (
        <LeadDuplicateWarning
          className="mb-4"
          duplicates={duplicates.map((duplicate) => ({
            id: duplicate.id,
            name: duplicate.name,
            statusLabel: duplicate.statusLabel,
            assignedToName: duplicate.assignedToName,
            matchedOn: duplicate.matchedOn,
            createdAt: duplicate.createdAt.toISOString(),
          }))}
        />
      )}

      {lead.customer && (
        <Card className="mb-4 border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm text-emerald-900">
            Converted{lead.convertedAt ? ` on ${formatDate(lead.convertedAt)}` : ""} — this lead is
            now{" "}
            <Link
              href={`/admin/customers?q=${encodeURIComponent(lead.customer.email || lead.customer.phone)}`}
              className="inline-flex items-center gap-1 font-medium underline underline-offset-2"
            >
              {lead.customer.name}
              <ExternalLink className="h-3 w-3" />
            </Link>
            .
          </p>
        </Card>
      )}

      {lead.status === "LOST" && lead.lostReason && (
        <Card className="mb-4 border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-900">
            <span className="font-semibold">Lost:</span> {lead.lostReason}
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <LeadScoreCard score={score} />

          <Card className="p-5">
            <h2 className="mb-3 font-semibold text-admin-text">Contact</h2>
            <dl className="space-y-2 text-sm">
              <Detail label="Phone" value={lead.phone} />
              <Detail label="Email" value={lead.email || "—"} />
              <Detail label="WhatsApp" value={lead.whatsapp || "—"} />
              <Detail label="Country" value={lead.country || "—"} />
              <Detail label="Source" value={leadSourceLabel(lead.source)} />
            </dl>

            {lead.message && (
              <div className="mt-4 rounded-lg bg-admin-bg p-3 text-sm text-admin-text">
                {lead.message}
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={`tel:${lead.phone}`}
                className="inline-flex h-9 items-center rounded-lg border border-admin-border-strong px-3 text-sm font-medium hover:bg-admin-bg"
              >
                Call
              </a>
              {lead.whatsapp && (
                <a
                  href={buildWhatsAppLink(
                    lead.whatsapp,
                    `Hi ${lead.name}, thank you for your enquiry with Vacationdeal.`,
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center rounded-lg bg-[#25D366] px-3 text-sm font-medium text-white"
                >
                  WhatsApp
                </a>
              )}
            </div>
          </Card>

          {!ownLeadsOnly && (
            <Card className="p-5">
              <h2 className="mb-3 font-semibold text-admin-text">Assigned to</h2>
              {mayAssign ? (
                <LeadAssignSelect
                  leadId={lead.id}
                  value={lead.assignedToId}
                  members={members}
                  className="w-full"
                />
              ) : (
                <p className="text-sm font-medium text-admin-text">
                  {lead.assignedTo?.name ?? "Unassigned"}
                </p>
              )}
              <p className="mt-2 text-xs text-admin-text-muted">
                {lead.assignedTo
                  ? `${lead.assignedTo.name} is responsible for this lead.`
                  : "Nobody is responsible for this lead yet."}
              </p>
            </Card>
          )}

          <Card className="p-5">
            <h2 className="mb-3 font-semibold text-admin-text">Priority</h2>
            <LeadPrioritySelect leadId={lead.id} value={lead.priority} />
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 font-semibold text-admin-text">Pipeline history</h2>
            <LeadStatusHistory
              changes={history.map((change) => ({
                id: change.id,
                fromStatus: change.fromStatus,
                toStatus: change.toStatus,
                reason: change.reason,
                at: change.at.toISOString(),
                byName: change.byName,
                heldForMs: change.heldForMs,
              }))}
            />
          </Card>

          {(lead.campaign ||
            lead.medium ||
            lead.referrer ||
            lead.landingPage ||
            lead.gclid ||
            lead.fbclid) && (
            <Card className="p-5">
              <h2 className="mb-3 font-semibold text-admin-text">Marketing attribution</h2>
              <dl className="space-y-2 text-sm">
                <Detail label="Channel" value={leadSourceLabel(lead.source)} />
                <Detail label="Medium" value={lead.medium || "—"} />
                <Detail label="Campaign" value={lead.campaign || "—"} />
                <Detail label="Term" value={lead.term || "—"} />
                <Detail label="Content" value={lead.content || "—"} />
                <Detail label="Landing page" value={lead.landingPage || "—"} />
                <Detail label="Referrer" value={lead.referrer || "—"} />
                {lead.gclid && <Detail label="Google click id" value={lead.gclid} />}
                {lead.fbclid && <Detail label="Meta click id" value={lead.fbclid} />}
              </dl>
            </Card>
          )}

          <Card className="p-5">
            <h2 className="mb-3 font-semibold text-admin-text">Engagement</h2>
            <dl className="space-y-2 text-sm">
              <Detail label="Emails sent" value={String(emailCount)} />
              <Detail label="Calls logged" value={String(callCount)} />
              <Detail label="Last activity" value={lastTouch ? formatDate(lastTouch) : "None yet"} />
            </dl>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card className="p-5">
            <h2 className="mb-3 font-semibold text-admin-text">Next steps</h2>
            <LeadFollowUpTasks
              leadId={lead.id}
              readOnly={!mayUpdate}
              items={followUps.map((item) => ({
                id: item.id,
                dueAt: item.dueAt.toISOString(),
                type: item.type,
                typeLabel: item.typeLabel,
                title: item.title,
                note: item.note,
                status: item.status,
                completedAt: item.completedAt?.toISOString() ?? null,
                outcome: item.outcome,
                assignedToName: item.assignedToName,
              }))}
            />
          </Card>

          <Card className="p-5">
            <h2 className="mb-1 font-semibold text-admin-text">Trip details</h2>
            <p className="mb-3 text-xs text-admin-text-muted">
              What the customer actually wants — fills the quotation and feeds the lead score.
            </p>
            <LeadQualificationForm
              leadId={lead.id}
              readOnly={!mayUpdate}
              packages={packages}
              destinations={destinations}
              tagSuggestions={tagSuggestions}
              initial={{
                destination: lead.destination ?? "",
                destinationId: lead.destinationId ?? "",
                packageId: lead.packageId ?? "",
                travelDate: dateInputValue(lead.travelDate),
                returnDate: dateInputValue(lead.returnDate),
                adults: lead.adults?.toString() ?? "",
                children: lead.children?.toString() ?? "",
                rooms: lead.rooms?.toString() ?? "",
                budget: lead.budget ?? "",
                tripType: lead.tripType ?? "",
                tags,
              }}
            />
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 font-semibold text-admin-text">Quotation</h2>
            <LeadDocumentButton leadId={lead.id} />
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 font-semibold text-admin-text">Send an email</h2>
            <LeadEmailForm leadId={lead.id} leadEmail={lead.email} />
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 font-semibold text-admin-text">Activity timeline</h2>
            <LeadTimeline
              leadId={lead.id}
              items={lead.notes.map((note) => ({
                id: note.id,
                type: note.type,
                body: note.body,
                subject: note.subject,
                emailTo: note.emailTo,
                delivered: note.delivered,
                createdAt: note.createdAt.toISOString(),
                author: note.author?.name ?? null,
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
      <dt className="text-admin-text-muted">{label}</dt>
      <dd className="text-right font-medium text-admin-text">{value}</dd>
    </div>
  );
}
