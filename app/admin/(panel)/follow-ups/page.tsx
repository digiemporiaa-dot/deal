import Link from "next/link";
import { AlertTriangle, ClipboardList } from "lucide-react";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission, currentUser, can } from "@/lib/guard";
import { canAssignLeads, isLeadOwnerOnly } from "@/lib/permissions";
import {
  followUpQueue,
  QUEUE_BUCKETS,
  BUCKET_LABELS,
  FOLLOW_UP_TYPES,
  followUpTypeLabel,
  ESCALATION_DAYS,
  type QueueBucket,
} from "@/lib/services/follow-up";
import { PageHeader, Card, FilterBar, buttonClasses } from "@/components/admin/ui";
import { Input, Select, FilterLabel } from "@/components/ui/Field";
import { FollowUpQueue } from "@/components/admin/FollowUpQueue";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const querySchema = z.object({
  q: z.string().trim().max(120).optional(),
  owner: z.string().trim().max(60).optional(),
  type: z.enum(FOLLOW_UP_TYPES).optional(),
  bucket: z.enum(QUEUE_BUCKETS).optional(),
});

/**
 * The follow-up queue.
 *
 * "Follow-ups" used to be a saved search — `/admin/leads?due=today` — which
 * could only ever show one date per lead and had no idea what the follow-up
 * was *for*. This is the real thing: every outstanding task, bucketed by
 * urgency, each one closable without leaving the page.
 */
export default async function FollowUpsPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("leads:view");
  const actor = await currentUser();

  const raw = await searchParams;
  const parsed = querySchema.safeParse({
    q: first(raw.q),
    owner: first(raw.owner),
    type: first(raw.type),
    bucket: first(raw.bucket),
  });
  const query = parsed.success ? parsed.data : {};

  const ownLeadsOnly = isLeadOwnerOnly(actor?.role);
  const mayAssign = canAssignLeads(actor?.role);

  const [queue, members, mayUpdate] = await Promise.all([
    followUpQueue(actor, query),
    mayAssign
      ? prisma.user.findMany({
          where: { isActive: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([] as { id: string; name: string }[]),
    can("leads:update"),
  ]);

  const groups = QUEUE_BUCKETS.map((bucket) => ({
    bucket,
    label: BUCKET_LABELS[bucket],
    items: queue.items
      .filter((item) => item.bucket === bucket)
      .map((item) => ({
        id: item.id,
        leadId: item.leadId,
        title: item.title,
        type: item.type,
        typeLabel: item.typeLabel,
        note: item.note,
        dueAt: item.dueAt.toISOString(),
        bucket: item.bucket,
        daysLate: item.daysLate,
        escalated: item.escalated,
        assignedToName: item.assignedToName,
        leadName: item.leadName,
        leadPhone: item.leadPhone,
        leadStatus: item.leadStatus,
        leadScore: item.leadScore,
        leadScoreBand: item.leadScoreBand,
        leadDestination: item.leadDestination,
      })),
  }));

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, String(value));
  }

  const bucketHref = (bucket: QueueBucket | null) => {
    const next = new URLSearchParams(params.toString());
    next.delete("bucket");
    if (bucket) next.set("bucket", bucket);
    const search = next.toString();
    return search ? `/admin/follow-ups?${search}` : "/admin/follow-ups";
  };

  const total = QUEUE_BUCKETS.reduce((sum, bucket) => sum + queue.counts[bucket], 0);

  return (
    <div>
      <PageHeader
        title={ownLeadsOnly ? "My follow-ups" : "Follow-ups"}
        description={
          total === 0
            ? "Nothing outstanding."
            : `${total} outstanding — ${queue.counts.overdue} overdue, ${queue.counts.today} due today.`
        }
        action={
          <Link href="/admin/leads" className={buttonClasses("outline")}>
            <ClipboardList className="h-4 w-4" />
            All leads
          </Link>
        }
      />

      {queue.escalated > 0 && (
        <Card className="mb-4 border-red-200 bg-red-50 p-3">
          <p className="flex items-center gap-2 text-sm text-red-900">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              <strong>{queue.escalated}</strong> follow-up
              {queue.escalated === 1 ? " is" : "s are"} more than {ESCALATION_DAYS} days late. A lead
              nobody has touched in that long is going cold.
            </span>
          </p>
        </Card>
      )}

      {/* Urgency buckets double as the filter. */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {QUEUE_BUCKETS.map((bucket) => {
          const active = query.bucket === bucket;
          const count = queue.counts[bucket];
          const urgent = bucket === "overdue" && count > 0;
          return (
            <Link
              key={bucket}
              href={bucketHref(active ? null : bucket)}
              aria-pressed={active}
              className={cn(
                "admin-card admin-card-shadow px-3 py-2.5 transition-colors",
                urgent ? "border-red-300 bg-red-50 hover:bg-red-100" : "hover:border-brand-300",
                active && (urgent ? "ring-1 ring-red-400" : "border-brand-500 ring-1 ring-brand-500"),
              )}
            >
              <p
                className={cn(
                  "font-display text-lg font-bold leading-none",
                  urgent ? "text-red-700" : "text-admin-text",
                )}
              >
                {count}
              </p>
              <p
                className={cn(
                  "mt-1.5 text-[11px] font-medium",
                  urgent ? "text-red-600" : "text-admin-text-muted",
                )}
              >
                {BUCKET_LABELS[bucket]}
              </p>
            </Link>
          );
        })}
      </div>

      <FilterBar>
        <div className="min-w-[200px] flex-1">
          <FilterLabel htmlFor="q">Search</FilterLabel>
          <Input
            inputSize="sm"
            id="q"
            name="q"
            defaultValue={query.q ?? ""}
            placeholder="Task, lead name, phone or email"
          />
        </div>

        <div>
          <FilterLabel htmlFor="type">Kind</FilterLabel>
          <Select inputSize="sm" id="type" name="type" defaultValue={query.type ?? ""}>
            <option value="">Any</option>
            {FOLLOW_UP_TYPES.map((type) => (
              <option key={type} value={type}>
                {followUpTypeLabel(type)}
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

        {query.bucket && <input type="hidden" name="bucket" value={query.bucket} />}

        <button type="submit" className={buttonClasses("primary", "sm")}>
          Apply
        </button>
        <a href="/admin/follow-ups" className={buttonClasses("ghost", "sm")}>
          Reset
        </a>
      </FilterBar>

      <Card className="overflow-hidden p-0">
        <FollowUpQueue groups={groups} variant="full" canEdit={mayUpdate} />
      </Card>
    </div>
  );
}
