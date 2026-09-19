import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission, currentUser } from "@/lib/guard";
import { canAssignLeads, isLeadOwnerOnly } from "@/lib/permissions";
import { listLeads, leadPipelineCounts, leadSourceOptions } from "@/lib/services/crm";
import { leadQuerySchema } from "@/lib/validation";
import { LEAD_STATUSES, LEAD_PRIORITIES, leadStatusLabel, leadSourceLabel } from "@/lib/crm";
import { PageHeader, Card, EmptyState, FilterBar, Pagination } from "@/components/admin/ui";
import { Input, Label, Select } from "@/components/ui/Field";
import { LeadTable } from "@/components/admin/LeadTable";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LeadsPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("leads:view");
  const actor = await currentUser();

  const raw = await searchParams;
  const parsed = leadQuerySchema.safeParse({
    q: first(raw.q),
    status: first(raw.status),
    source: first(raw.source),
    priority: first(raw.priority),
    destination: first(raw.destination),
    owner: first(raw.owner),
    budget: first(raw.budget),
    due: first(raw.due),
    from: first(raw.from),
    to: first(raw.to),
    sort: first(raw.sort) ?? "followup",
    page: first(raw.page) ?? 1,
    perPage: first(raw.perPage) ?? 25,
  });

  // An invalid query string falls back to the default view rather than
  // reaching Prisma with unvalidated values.
  const query = parsed.success ? parsed.data : leadQuerySchema.parse({});

  const ownLeadsOnly = isLeadOwnerOnly(actor?.role);
  const mayAssign = canAssignLeads(actor?.role);

  const [{ rows, total, page, pageCount }, counts, sources, members] = await Promise.all([
    listLeads(query, actor),
    leadPipelineCounts(actor),
    leadSourceOptions(actor),
    mayAssign
      ? prisma.user.findMany({
          where: { isActive: true },
          select: { id: true, name: true, role: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([] as { id: string; name: string; role: string }[]),
  ]);

  const params: Record<string, string | undefined> = {
    q: query.q,
    status: query.status,
    source: query.source,
    priority: query.priority,
    destination: query.destination,
    owner: query.owner,
    budget: query.budget,
    due: query.due,
    from: query.from || undefined,
    to: query.to || undefined,
    sort: query.sort,
    perPage: String(query.perPage),
  };

  return (
    <div>
      <PageHeader
        title={ownLeadsOnly ? "My Leads" : "Leads & CRM"}
        description={
          ownLeadsOnly
            ? "Enquiries assigned to you — follow up and close them."
            : "Every enquiry, from first touch to booking."
        }
      />

      {/* Pipeline */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        {LEAD_STATUSES.map((status) => (
          <Link
            key={status}
            href={`/admin/leads?status=${status}`}
            className="rounded-xl border border-slate-200 bg-white p-3 text-center transition-colors hover:border-brand-300 hover:bg-brand-50"
          >
            <p className="text-lg font-bold text-slate-900">{counts.statusCount(status)}</p>
            <p className="text-xs font-medium text-slate-500">{leadStatusLabel(status)}</p>
          </Link>
        ))}
        <Link
          href="/admin/leads?due=overdue"
          className={`rounded-xl border p-3 text-center transition-colors ${
            counts.overdue > 0
              ? "border-red-300 bg-red-50 hover:bg-red-100"
              : "border-slate-200 bg-white hover:bg-slate-50"
          }`}
        >
          <p className={`text-lg font-bold ${counts.overdue > 0 ? "text-red-700" : "text-slate-900"}`}>
            {counts.overdue}
          </p>
          <p className={`text-xs font-medium ${counts.overdue > 0 ? "text-red-600" : "text-slate-500"}`}>
            Overdue
          </p>
        </Link>
      </div>

      {/* Follow-up shortcuts */}
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link
          href="/admin/leads?due=today"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
        >
          Today&rsquo;s follow-ups
          <span className="rounded bg-slate-100 px-1.5 text-xs">{counts.dueToday}</span>
        </Link>
        <Link
          href="/admin/leads?due=upcoming"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
        >
          Upcoming
          <span className="rounded bg-slate-100 px-1.5 text-xs">{counts.upcoming}</span>
        </Link>
        {!ownLeadsOnly && (
          <Link
            href="/admin/leads?owner=none"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
          >
            Unassigned
            <span className="rounded bg-slate-100 px-1.5 text-xs">{counts.unassigned}</span>
          </Link>
        )}
      </div>

      <FilterBar>
        <div className="min-w-[220px] flex-1">
          <Label htmlFor="q">Search</Label>
          <Input id="q" name="q" defaultValue={query.q ?? ""} placeholder="Name, phone, email or campaign" />
        </div>
        <div>
          <Label htmlFor="status">Status</Label>
          <Select id="status" name="status" defaultValue={query.status ?? ""}>
            <option value="">All statuses</option>
            {LEAD_STATUSES.map((status) => (
              <option key={status} value={status}>
                {leadStatusLabel(status)}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="source">Source</Label>
          <Select id="source" name="source" defaultValue={query.source ?? ""}>
            <option value="">All sources</option>
            {sources.map((source) => (
              <option key={source} value={source}>
                {leadSourceLabel(source)}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="priority">Priority</Label>
          <Select id="priority" name="priority" defaultValue={query.priority ?? ""}>
            <option value="">Any</option>
            {LEAD_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority.charAt(0) + priority.slice(1).toLowerCase()}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="destination">Destination</Label>
          <Input
            id="destination"
            name="destination"
            defaultValue={query.destination ?? ""}
            placeholder="Bali"
          />
        </div>
        <div>
          <Label htmlFor="budget">Budget</Label>
          <Input id="budget" name="budget" defaultValue={query.budget ?? ""} placeholder="50000" />
        </div>
        {!ownLeadsOnly && (
          <div>
            <Label htmlFor="owner">Assigned to</Label>
            <Select id="owner" name="owner" defaultValue={query.owner ?? ""}>
              <option value="">Anyone</option>
              <option value="me">Me</option>
              <option value="none">Unassigned</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div>
          <Label htmlFor="due">Follow-up</Label>
          <Select id="due" name="due" defaultValue={query.due ?? ""}>
            <option value="">All</option>
            <option value="overdue">Overdue</option>
            <option value="today">Due today</option>
            <option value="upcoming">Upcoming</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="from">Created from</Label>
          <Input id="from" name="from" type="date" defaultValue={query.from ?? ""} />
        </div>
        <div>
          <Label htmlFor="to">to</Label>
          <Input id="to" name="to" type="date" defaultValue={query.to ?? ""} />
        </div>
        <div>
          <Label htmlFor="sort">Sort</Label>
          <Select id="sort" name="sort" defaultValue={query.sort}>
            <option value="followup">Follow-up date</option>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="activity">Recent activity</option>
          </Select>
        </div>
        <button
          type="submit"
          className="inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Filter
        </button>
        <a
          href="/admin/leads"
          className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Reset
        </a>
      </FilterBar>

      {rows.length === 0 ? (
        <EmptyState
          title={ownLeadsOnly ? "No leads assigned to you yet" : "No leads match these filters"}
          description={
            ownLeadsOnly
              ? "Your manager will assign enquiries to you — they will appear here."
              : "Enquiries submitted from the website appear here. Try clearing the filters."
          }
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <LeadTable
            leads={rows.map((lead) => ({
              id: lead.id,
              name: lead.name,
              email: lead.email,
              phone: lead.phone,
              whatsapp: lead.whatsapp,
              destination: lead.destination,
              budget: lead.budget,
              source: lead.source,
              campaign: lead.campaign,
              status: lead.status,
              priority: lead.priority,
              createdAt: lead.createdAt.toISOString(),
              nextFollowUpAt: lead.nextFollowUpAt?.toISOString() ?? null,
              lastActivityAt: lead.lastActivityAt?.toISOString() ?? null,
              assignedToId: lead.assignedToId,
              assignedToName: lead.assignedTo?.name ?? null,
              activityCount: lead._count.notes,
            }))}
            members={members}
            showOwner={!ownLeadsOnly}
            canAssign={mayAssign}
          />
        </Card>
      )}

      <Pagination
        page={page}
        pageCount={pageCount}
        total={total}
        basePath="/admin/leads"
        params={params}
      />
    </div>
  );
}
