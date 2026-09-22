import Link from "next/link";
import { Download, LayoutGrid } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePermission, currentUser, can } from "@/lib/guard";
import { canAssignLeads, isLeadOwnerOnly } from "@/lib/permissions";
import { listLeads, leadPipelineCounts, leadSourceOptions } from "@/lib/services/crm";
import { leadBandCounts, leadTagOptions } from "@/lib/services/lead-workspace";
import { leadQuerySchema } from "@/lib/validation";
import {
  LEAD_STATUSES,
  LEAD_PRIORITIES,
  leadStatusLabel,
  leadSourceLabel,
  parseTags,
} from "@/lib/crm";
import { leadStatusTone, humanStatus } from "@/lib/admin-status";
import {
  PageHeader,
  Card,
  FilterBar,
  Pagination,
  StatusBadge,
  buttonClasses,
} from "@/components/admin/ui";
import { Input, Select, FilterLabel } from "@/components/ui/Field";
import { LeadTable } from "@/components/admin/LeadTable";
import { NewLeadButton } from "@/components/admin/NewLeadButton";
import { BandChips } from "@/components/admin/BandChips";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * The CRM list.
 *
 * Filtering, sorting and paging all happen in the database — the page never
 * loads more than one page of leads, whatever the pipeline size. The pipeline
 * strip doubles as the status filter, which is how most people actually
 * navigate a CRM.
 */
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
    band: first(raw.band),
    tag: first(raw.tag),
    state: first(raw.state),
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

  const [
    { rows, total, page, pageCount },
    counts,
    sources,
    bands,
    tags,
    members,
    mayCreate,
    mayExport,
  ] = await Promise.all([
      listLeads(query, actor),
      leadPipelineCounts(actor),
      leadSourceOptions(actor),
      leadBandCounts(actor),
      leadTagOptions(actor),
      mayAssign
        ? prisma.user.findMany({
            where: { isActive: true },
            select: { id: true, name: true, role: true },
            orderBy: { name: "asc" },
          })
        : Promise.resolve([] as { id: string; name: string; role: string }[]),
      can("leads:create"),
      can("export:data"),
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
    band: query.band,
    tag: query.tag,
    state: query.state,
    from: query.from || undefined,
    to: query.to || undefined,
    sort: query.sort,
    perPage: String(query.perPage),
  };

  const filtersApplied = Object.entries(params).some(
    ([key, value]) => value && key !== "sort" && key !== "perPage",
  );

  return (
    <div>
      <PageHeader
        title={ownLeadsOnly ? "My leads" : "Leads"}
        description={
          ownLeadsOnly
            ? "Enquiries assigned to you — follow up and close them."
            : "Every enquiry, from first touch to booking."
        }
        action={
          <>
            <Link href="/admin/leads/board" className={buttonClasses("outline")}>
              <LayoutGrid className="h-4 w-4" />
              Board
            </Link>
            {mayExport && (
              <Link href="/admin/export" className={buttonClasses("outline")}>
                <Download className="h-4 w-4" />
                Export
              </Link>
            )}
            {mayCreate && (
              <NewLeadButton
                members={members.map((member) => ({ id: member.id, name: member.name }))}
                canAssign={mayAssign}
              />
            )}
          </>
        }
      />

      {/* Pipeline. Each tile is also the status filter. */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {LEAD_STATUSES.map((status) => {
          const active = query.status === status;
          return (
            <Link
              key={status}
              href={active ? "/admin/leads" : `/admin/leads?status=${status}`}
              aria-pressed={active}
              className={cn(
                "admin-card admin-card-shadow px-3 py-2.5 transition-colors",
                active ? "border-brand-500 ring-1 ring-brand-500" : "hover:border-brand-300",
              )}
            >
              <p className="font-display text-lg font-bold leading-none text-admin-text">
                {counts.statusCount(status)}
              </p>
              <p className="mt-1.5 flex items-center gap-1.5">
                <StatusBadge tone={leadStatusTone(status)} dot className="px-0 ring-0">
                  {leadStatusLabel(status)}
                </StatusBadge>
              </p>
            </Link>
          );
        })}
        <Link
          href={query.due === "overdue" ? "/admin/leads" : "/admin/leads?due=overdue"}
          className={cn(
            "admin-card admin-card-shadow px-3 py-2.5 transition-colors",
            counts.overdue > 0 ? "border-red-300 bg-red-50 hover:bg-red-100" : "hover:border-brand-300",
            query.due === "overdue" && "ring-1 ring-red-400",
          )}
        >
          <p
            className={cn(
              "font-display text-lg font-bold leading-none",
              counts.overdue > 0 ? "text-red-700" : "text-admin-text",
            )}
          >
            {counts.overdue}
          </p>
          <p
            className={cn(
              "mt-1.5 text-[11px] font-medium",
              counts.overdue > 0 ? "text-red-600" : "text-admin-text-muted",
            )}
          >
            Overdue
          </p>
        </Link>
      </div>

      <BandChips counts={bands} active={query.band} basePath="/admin/leads" />

      {/* Saved views. */}
      <div className="mb-4 flex flex-wrap gap-1.5 text-[13px]">
        <QuickFilter href="/admin/leads?due=today" label="Due today" count={counts.dueToday} />
        <QuickFilter href="/admin/leads?due=upcoming" label="Upcoming" count={counts.upcoming} />
        {!ownLeadsOnly && (
          <>
            <QuickFilter href="/admin/leads?owner=none" label="Unassigned" count={counts.unassigned} />
            <QuickFilter href="/admin/leads?owner=me" label="Mine" />
          </>
        )}
        <QuickFilter href="/admin/leads?priority=URGENT" label="Urgent" />
      </div>

      <FilterBar>
        <div className="min-w-[200px] flex-1">
          <FilterLabel htmlFor="q">Search</FilterLabel>
          <Input
            inputSize="sm"
            id="q"
            name="q"
            defaultValue={query.q ?? ""}
            placeholder="Name, phone, email or campaign"
          />
        </div>

        <div>
          <FilterLabel htmlFor="status">Status</FilterLabel>
          <Select inputSize="sm" id="status" name="status" defaultValue={query.status ?? ""}>
            <option value="">All</option>
            {LEAD_STATUSES.map((status) => (
              <option key={status} value={status}>
                {leadStatusLabel(status)}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <FilterLabel htmlFor="source">Source</FilterLabel>
          <Select inputSize="sm" id="source" name="source" defaultValue={query.source ?? ""}>
            <option value="">All</option>
            {sources.map((source) => (
              <option key={source} value={source}>
                {leadSourceLabel(source)}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <FilterLabel htmlFor="priority">Priority</FilterLabel>
          <Select inputSize="sm" id="priority" name="priority" defaultValue={query.priority ?? ""}>
            <option value="">Any</option>
            {LEAD_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {humanStatus(priority)}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <FilterLabel htmlFor="destination">Destination</FilterLabel>
          <Input
            inputSize="sm"
            id="destination"
            name="destination"
            defaultValue={query.destination ?? ""}
            placeholder="Kashmir"
            className="w-[130px]"
          />
        </div>

        {!ownLeadsOnly && (
          <div>
            <FilterLabel htmlFor="owner">Owner</FilterLabel>
            <Select inputSize="sm" id="owner" name="owner" defaultValue={query.owner ?? ""}>
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
          <FilterLabel htmlFor="tag">Tag</FilterLabel>
          <Select inputSize="sm" id="tag" name="tag" defaultValue={query.tag ?? ""}>
            <option value="">Any</option>
            {tags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <FilterLabel htmlFor="due">Follow-up</FilterLabel>
          <Select inputSize="sm" id="due" name="due" defaultValue={query.due ?? ""}>
            <option value="">All</option>
            <option value="overdue">Overdue</option>
            <option value="today">Due today</option>
            <option value="upcoming">Upcoming</option>
          </Select>
        </div>

        <div>
          <FilterLabel htmlFor="from">From</FilterLabel>
          <Input
            inputSize="sm"
            id="from"
            name="from"
            type="date"
            defaultValue={query.from ?? ""}
            className="w-[140px]"
          />
        </div>

        <div>
          <FilterLabel htmlFor="to">To</FilterLabel>
          <Input
            inputSize="sm"
            id="to"
            name="to"
            type="date"
            defaultValue={query.to ?? ""}
            className="w-[140px]"
          />
        </div>

        <div>
          <FilterLabel htmlFor="sort">Sort</FilterLabel>
          <Select inputSize="sm" id="sort" name="sort" defaultValue={query.sort}>
            <option value="followup">Follow-up date</option>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="activity">Recent activity</option>
            <option value="score">Lead score</option>
          </Select>
        </div>

        <button type="submit" className={buttonClasses("primary", "sm")}>
          Apply
        </button>
        {filtersApplied && (
          <a href="/admin/leads" className={buttonClasses("ghost", "sm")}>
            Reset
          </a>
        )}
      </FilterBar>

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
            score: lead.score,
            scoreBand: lead.scoreBand,
            tags: parseTags(lead.tags),
          }))}
          members={members}
          showOwner={!ownLeadsOnly}
          canAssign={mayAssign}
        />
      </Card>

      <Pagination
        page={page}
        pageCount={pageCount}
        total={total}
        basePath="/admin/leads"
        params={params}
        unit="lead"
      />
    </div>
  );
}

function QuickFilter({ href, label, count }: { href: string; label: string; count?: number }) {
  return (
    <Link
      href={href}
      className="admin-focus inline-flex items-center gap-1.5 rounded-control border border-admin bg-admin-card px-2.5 py-1.5 font-medium text-admin-text-muted transition-colors hover:border-brand-300 hover:text-brand-700"
    >
      {label}
      {count !== undefined && (
        <span className="rounded bg-admin-muted px-1.5 text-[11px] tabular-nums">{count}</span>
      )}
    </Link>
  );
}
