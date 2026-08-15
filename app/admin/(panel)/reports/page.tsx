import Link from "next/link";
import { TrendingUp, Users, IndianRupee, Target, AlertTriangle, Wallet } from "lucide-react";
import { PageHeader, Card, StatCard } from "@/components/admin/ui";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/utils";
import { buildReport } from "@/lib/reports";

export const dynamic = "force-dynamic";

const RANGES = [
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "year", label: "This year" },
  { key: "all", label: "All time" },
];

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const sp = await searchParams;
  const data = await buildReport(sp.period);
  const t = data.totals;

  const maxRevenue = Math.max(...data.months.map((m) => m.revenue), 1);
  const maxLeads = Math.max(...data.months.map((m) => m.leads), 1);
  const maxStatus = Math.max(...data.statusCounts.map((s) => s.count), 1);

  return (
    <div>
      <PageHeader
        title="Reports"
        description={`Performance overview — ${data.period.label.toLowerCase()}`}
      />

      {/* Range picker */}
      <div className="mb-5 flex flex-wrap gap-2">
        {RANGES.map((r) => {
          const active = (sp.period || "30d") === r.key;
          return (
            <Link
              key={r.key}
              href={`/admin/reports?period=${r.key}`}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 text-slate-600 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
              }`}
            >
              {r.label}
            </Link>
          );
        })}
      </div>

      {/* Headline numbers */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Revenue" value={formatCurrency(t.revenue)} icon={<IndianRupee className="h-5 w-5" />} tone="green" />
        <StatCard label="Collected" value={formatCurrency(t.collected)} icon={<Wallet className="h-5 w-5" />} />
        <StatCard label="Bookings" value={t.bookings} icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard label="Avg booking" value={formatCurrency(t.avgBookingValue)} icon={<IndianRupee className="h-5 w-5" />} />
        <StatCard label="Leads" value={t.leads} icon={<Users className="h-5 w-5" />} tone="purple" />
        <StatCard label="Converted" value={t.converted} icon={<Target className="h-5 w-5" />} tone="green" />
        <StatCard label="Conversion rate" value={`${t.conversionRate}%`} icon={<Target className="h-5 w-5" />} tone="brand" />
        <StatCard label="Follow-ups overdue" value={t.overdue} icon={<AlertTriangle className="h-5 w-5" />} tone={t.overdue > 0 ? "amber" : undefined} />
      </div>

      {(t.unassigned > 0 || t.outstanding > 0) && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {t.unassigned > 0 && (
            <Link href="/admin/leads?owner=none" className="rounded-xl border border-amber-200 bg-amber-50 p-4 hover:bg-amber-100">
              <p className="text-sm font-semibold text-amber-900">{t.unassigned} lead{t.unassigned === 1 ? "" : "s"} not assigned to anyone</p>
              <p className="mt-0.5 text-xs text-amber-700">Nobody is responsible for these — assign them now.</p>
            </Link>
          )}
          {t.outstanding > 0 && (
            <Link href="/admin/invoices" className="rounded-xl border border-red-200 bg-red-50 p-4 hover:bg-red-100">
              <p className="text-sm font-semibold text-red-900">{formatCurrency(t.outstanding)} outstanding on invoices</p>
              <p className="mt-0.5 text-xs text-red-700">Money invoiced but not yet received.</p>
            </Link>
          )}
        </div>
      )}

      {/* Revenue by month */}
      <Card className="mt-6 p-5">
        <div className="mb-5 flex items-baseline justify-between">
          <h2 className="font-semibold text-slate-900">Revenue by month</h2>
          <span className="text-xs text-slate-400">Last 12 months</span>
        </div>
        <div className="flex h-52 items-end gap-1.5 sm:gap-3">
          {data.months.map((m) => (
            <div key={m.month} className="group flex flex-1 flex-col items-center gap-1.5">
              <span className="text-[10px] font-semibold text-slate-500 opacity-0 transition-opacity group-hover:opacity-100">
                {m.revenue > 0 ? formatCurrency(m.revenue) : ""}
              </span>
              <div className="flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-brand-600 to-brand-400 transition-all"
                  style={{ height: `${Math.max((m.revenue / maxRevenue) * 100, m.revenue > 0 ? 3 : 1)}%` }}
                  title={`${m.month}: ${formatCurrency(m.revenue)} from ${m.bookings} booking(s)`}
                />
              </div>
              <span className="text-[10px] text-slate-500">{m.month}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Leads by month */}
      <Card className="mt-4 p-5">
        <h2 className="mb-5 font-semibold text-slate-900">Enquiries by month</h2>
        <div className="flex h-36 items-end gap-1.5 sm:gap-3">
          {data.months.map((m) => (
            <div key={m.month} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="text-[10px] font-semibold text-slate-600">{m.leads || ""}</span>
              <div className="flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-t-md bg-purple-400"
                  style={{ height: `${Math.max((m.leads / maxLeads) * 100, m.leads > 0 ? 3 : 1)}%` }}
                  title={`${m.month}: ${m.leads} enquiries`}
                />
              </div>
              <span className="text-[10px] text-slate-500">{m.month}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Staff performance */}
      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Team performance</h2>
          <p className="mt-0.5 text-xs text-slate-500">Leads assigned in this period and what happened to them</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Team member</th>
                <th className="px-4 py-3 text-center">Assigned</th>
                <th className="px-4 py-3 text-center">Open</th>
                <th className="px-4 py-3 text-center">Won</th>
                <th className="px-4 py-3 text-center">Lost</th>
                <th className="px-4 py-3 text-center">Emails</th>
                <th className="px-4 py-3 text-center">Calls</th>
                <th className="px-4 py-3 text-center">Overdue</th>
                <th className="px-5 py-3">Conversion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.staff.filter((s) => s.assigned > 0 || s.emailsSent > 0 || s.callsLogged > 0).length === 0 && (
                <tr>
                  <td colSpan={9} className="px-5 py-8 text-center text-sm text-slate-400">
                    No lead activity in this period yet.
                  </td>
                </tr>
              )}
              {data.staff
                .filter((s) => s.assigned > 0 || s.emailsSent > 0 || s.callsLogged > 0)
                .map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <span className="font-medium text-slate-900">{s.name}</span>
                      <span className="block text-[11px] uppercase tracking-wide text-slate-400">
                        {s.role.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-slate-900">{s.assigned}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{s.open}</td>
                    <td className="px-4 py-3 text-center font-semibold text-emerald-600">{s.converted}</td>
                    <td className="px-4 py-3 text-center text-slate-500">{s.lost}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{s.emailsSent}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{s.callsLogged}</td>
                    <td className={`px-4 py-3 text-center font-semibold ${s.overdue > 0 ? "text-red-600" : "text-slate-400"}`}>
                      {s.overdue || "—"}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full ${s.conversionRate >= 50 ? "bg-emerald-500" : s.conversionRate >= 25 ? "bg-amber-400" : "bg-slate-300"}`}
                            style={{ width: `${s.conversionRate}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-slate-600">{s.conversionRate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Pipeline funnel */}
        <Card className="p-5">
          <h2 className="mb-4 font-semibold text-slate-900">Lead pipeline</h2>
          <div className="space-y-3">
            {data.statusCounts.map((s) => (
              <div key={s.status}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">{s.status.replace(/_/g, " ")}</span>
                  <span className="font-semibold text-slate-900">{s.count}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${
                      s.status === "CONVERTED" ? "bg-emerald-500" : s.status === "LOST" ? "bg-red-400" : "bg-brand-500"
                    }`}
                    style={{ width: `${(s.count / maxStatus) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Sources */}
        <Card className="p-5">
          <h2 className="mb-4 font-semibold text-slate-900">Where leads come from</h2>
          {data.sources.length === 0 ? (
            <p className="text-sm text-slate-400">No leads in this period.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="pb-2">Source</th>
                  <th className="pb-2 text-center">Leads</th>
                  <th className="pb-2 text-center">Won</th>
                  <th className="pb-2 text-right">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.sources.map((s) => (
                  <tr key={s.source}>
                    <td className="py-2.5 font-medium capitalize text-slate-900">{s.source}</td>
                    <td className="py-2.5 text-center text-slate-600">{s.total}</td>
                    <td className="py-2.5 text-center font-semibold text-emerald-600">{s.converted}</td>
                    <td className="py-2.5 text-right">
                      <Badge tone={s.rate >= 30 ? "green" : s.rate >= 10 ? "amber" : "slate"}>{s.rate}%</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {/* Top packages */}
      <Card className="mt-6 p-5">
        <h2 className="mb-4 font-semibold text-slate-900">Best selling packages</h2>
        {data.topPackages.length === 0 ? (
          <p className="text-sm text-slate-400">No bookings in this period.</p>
        ) : (
          <div className="space-y-3">
            {data.topPackages.map((p) => (
              <div key={p.name} className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{p.name}</p>
                  <p className="text-xs text-slate-500">{p.bookings} booking{p.bookings === 1 ? "" : "s"}</p>
                </div>
                <span className="shrink-0 font-semibold text-slate-900">{formatCurrency(p.revenue)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
