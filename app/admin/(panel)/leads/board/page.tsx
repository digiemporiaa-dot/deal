import Link from "next/link";
import { List } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePermission, currentUser, can } from "@/lib/guard";
import { canAssignLeads, isLeadOwnerOnly } from "@/lib/permissions";
import { leadBoard, leadBandCounts, leadTagOptions } from "@/lib/services/lead-workspace";
import { leadSourceOptions } from "@/lib/services/crm";
import { leadQuerySchema } from "@/lib/validation";
import { LEAD_PRIORITIES, leadSourceLabel } from "@/lib/crm";
import { humanStatus } from "@/lib/admin-status";
import { PageHeader, FilterBar, buttonClasses } from "@/components/admin/ui";
import { Input, Select, FilterLabel } from "@/components/ui/Field";
import { LeadBoard } from "@/components/admin/LeadBoard";
import { NewLeadButton } from "@/components/admin/NewLeadButton";
import { BandChips } from "@/components/admin/BandChips";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * The pipeline as a board.
 *
 * A second view of the same data, not a second system: it reads through the
 * same `buildLeadWhere` the list uses, so every filter behaves identically and
 * the ownership scope is enforced in exactly one place.
 */
export default async function LeadBoardPage({ searchParams }: { searchParams: SearchParams }) {
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
    band: first(raw.band),
    tag: first(raw.tag),
    due: first(raw.due),
    sort: first(raw.sort) ?? "score",
    page: 1,
    perPage: 25,
  });
  const query = parsed.success ? parsed.data : leadQuerySchema.parse({ sort: "score" });

  const ownLeadsOnly = isLeadOwnerOnly(actor?.role);
  const mayAssign = canAssignLeads(actor?.role);

  const [board, bands, tags, sources, members, mayCreate, mayUpdate] = await Promise.all([
    leadBoard(query, actor),
    leadBandCounts(actor),
    leadTagOptions(actor),
    leadSourceOptions(actor),
    mayAssign
      ? prisma.user.findMany({
          where: { isActive: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([] as { id: string; name: string }[]),
    can("leads:create"),
    can("leads:update"),
  ]);

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({
    q: query.q,
    source: query.source,
    priority: query.priority,
    destination: query.destination,
    owner: query.owner,
    tag: query.tag,
    due: query.due,
  })) {
    if (value) params.set(key, value);
  }
  const listHref = params.toString() ? `/admin/leads?${params}` : "/admin/leads";

  return (
    <div>
      <PageHeader
        title={ownLeadsOnly ? "My pipeline" : "Pipeline"}
        description="Drag a lead to move it. Won and lost are set on the lead itself, so nothing closes by accident."
        action={
          <>
            <Link href={listHref} className={buttonClasses("outline")}>
              <List className="h-4 w-4" />
              List view
            </Link>
            {mayCreate && (
              <NewLeadButton members={members} canAssign={mayAssign} />
            )}
          </>
        }
      />

      <BandChips counts={bands} active={query.band} basePath="/admin/leads/board" params={params} />

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
          <FilterLabel htmlFor="due">Follow-up</FilterLabel>
          <Select inputSize="sm" id="due" name="due" defaultValue={query.due ?? ""}>
            <option value="">All</option>
            <option value="overdue">Overdue</option>
            <option value="today">Due today</option>
            <option value="upcoming">Upcoming</option>
          </Select>
        </div>

        {/* Preserved so applying a filter does not silently drop the band. */}
        {query.band && <input type="hidden" name="band" value={query.band} />}

        <button type="submit" className={buttonClasses("primary", "sm")}>
          Apply
        </button>
        <a href="/admin/leads/board" className={buttonClasses("ghost", "sm")}>
          Reset
        </a>
      </FilterBar>

      <LeadBoard columns={board.columns} canEdit={mayUpdate} />
    </div>
  );
}
