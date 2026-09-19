import { Activity } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/guard";
import { listActivity, ACTIVITY_ACTIONS, ACTIVITY_ENTITIES } from "@/lib/activity";
import { activityQuerySchema } from "@/lib/validation";
import { PageHeader, Card, EmptyState, FilterBar, TableWrap, Pagination } from "@/components/admin/ui";
import { Badge } from "@/components/ui/Badge";
import { Input, Label, Select } from "@/components/ui/Field";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Tone per action, so destructive entries stand out when scanning. */
const ACTION_TONE: Record<string, "brand" | "green" | "amber" | "red" | "slate"> = {
  LOGIN: "green",
  LOGOUT: "slate",
  CREATE: "brand",
  UPDATE: "slate",
  DELETE: "red",
  STATUS_CHANGE: "amber",
  PAYMENT: "green",
  ASSIGN: "brand",
  UPLOAD: "slate",
  EXPORT: "amber",
  SETTINGS: "amber",
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ActivityLogPage({ searchParams }: { searchParams: SearchParams }) {
  // Reading the audit trail is its own permission.
  await requirePermission("activity:view");

  const raw = await searchParams;
  const parsed = activityQuerySchema.safeParse({
    q: first(raw.q),
    user: first(raw.user),
    action: first(raw.action),
    entity: first(raw.entity),
    from: first(raw.from),
    to: first(raw.to),
    page: first(raw.page) ?? 1,
  });

  // A hand-edited query string falls back to the default view rather than
  // reaching Prisma.
  const query = parsed.success
    ? parsed.data
    : activityQuerySchema.parse({ page: 1 });

  const [{ rows, total, page, pageCount }, users] = await Promise.all([
    listActivity({
      q: query.q,
      userId: query.user,
      action: query.action,
      entity: query.entity,
      from: query.from ? new Date(`${query.from}T00:00:00`) : undefined,
      to: query.to ? new Date(`${query.to}T23:59:59.999`) : undefined,
      page: query.page,
      perPage: 50,
    }),
    prisma.user.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const params: Record<string, string | undefined> = {
    q: query.q,
    user: query.user,
    action: query.action,
    entity: query.entity,
    from: query.from || undefined,
    to: query.to || undefined,
  };

  return (
    <div>
      <PageHeader
        title="Activity Log"
        description="Every sign-in and every change made in the admin panel, oldest entries last."
      />

      <FilterBar>
        <div className="min-w-[200px] flex-1">
          <Label htmlFor="q">Search</Label>
          <Input id="q" name="q" defaultValue={query.q ?? ""} placeholder="Booking number, name, description" />
        </div>
        <div>
          <Label htmlFor="user">Team member</Label>
          <Select id="user" name="user" defaultValue={query.user ?? ""}>
            <option value="">Everyone</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="action">Action</Label>
          <Select id="action" name="action" defaultValue={query.action ?? ""}>
            <option value="">All actions</option>
            {ACTIVITY_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a.replace(/_/g, " ").toLowerCase()}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="entity">Area</Label>
          <Select id="entity" name="entity" defaultValue={query.entity ?? ""}>
            <option value="">Everything</option>
            {ACTIVITY_ENTITIES.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="from">From</Label>
          <Input id="from" name="from" type="date" defaultValue={query.from ?? ""} />
        </div>
        <div>
          <Label htmlFor="to">To</Label>
          <Input id="to" name="to" type="date" defaultValue={query.to ?? ""} />
        </div>
        <button
          type="submit"
          className="inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Filter
        </button>
        <a
          href="/admin/activity-log"
          className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Reset
        </a>
      </FilterBar>

      {rows.length === 0 ? (
        <EmptyState
          title="Nothing to show"
          description="No activity matches these filters yet. Changes made in the admin panel will appear here."
        />
      ) : (
        <Card className="p-0">
          <TableWrap>
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Who</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Area</th>
                <th className="px-4 py-3 font-medium">What happened</th>
                <th className="px-4 py-3 font-medium">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                    {row.createdAt.toLocaleString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <p className="font-medium text-slate-900">{row.userName || "System"}</p>
                    {row.userRole && <p className="text-xs text-slate-500">{row.userRole}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={ACTION_TONE[row.action] ?? "slate"}>
                      {row.action.replace(/_/g, " ")}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{row.entity}</td>
                  <td className="px-4 py-3 text-slate-700">{row.description}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-400">
                    {row.ipAddress || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </Card>
      )}

      <Pagination
        page={page}
        pageCount={pageCount}
        total={total}
        basePath="/admin/activity-log"
        params={params}
      />

      <p className="mt-6 flex items-center gap-2 text-xs text-slate-400">
        <Activity className="h-3.5 w-3.5" />
        Entries are written automatically and cannot be edited or removed from the panel.
      </p>
    </div>
  );
}
