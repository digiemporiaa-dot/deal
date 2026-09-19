import Link from "next/link";
import {
  CalendarCheck,
  ClipboardList,
  IndianRupee,
  Wallet,
  Plane,
  Percent,
  TrendingUp,
  AlertTriangle,
  Receipt,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/guard";
import {
  getDashboardMetrics,
  getTrend,
  getSourceBreakdown,
  getTopPackages,
  getTopDestinations,
  getConversionFunnel,
} from "@/lib/analytics";
import { dashboardQuerySchema } from "@/lib/validation";
import { leadSourceLabel } from "@/lib/crm";
import { formatCurrency, formatDate, toNumber } from "@/lib/utils";
import { PageHeader, StatCard, Card, TableWrap } from "@/components/admin/ui";
import { Badge } from "@/components/ui/Badge";
import { LineChart, BarList, Funnel } from "@/components/admin/Charts";
import { Input, Label, Select } from "@/components/ui/Field";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const RANGES: { value: string; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "90d", label: "Last 90 days" },
  { value: "year", label: "This year" },
  { value: "all", label: "All time" },
  { value: "custom", label: "Custom range" },
];

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("dashboard:view");

  const raw = await searchParams;
  const parsed = dashboardQuerySchema.safeParse({
    range: first(raw.range) ?? "30d",
    from: first(raw.from),
    to: first(raw.to),
  });
  const query = parsed.success ? parsed.data : dashboardQuerySchema.parse({});

  const metrics = await getDashboardMetrics(query);
  const { range, revenue } = metrics;

  const [trend, sources, topPackages, topDestinations, funnel, recentBookings] = await Promise.all([
    getTrend(range),
    getSourceBreakdown(range),
    getTopPackages(range),
    getTopDestinations(range),
    getConversionFunnel(range),
    prisma.booking.findMany({
      take: 6,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        bookingNumber: true,
        createdAt: true,
        totalAmount: true,
        currency: true,
        status: true,
        paymentStatus: true,
        customer: { select: { name: true } },
        package: { select: { name: true } },
      },
    }),
  ]);

  const money = (amount: number) => formatCurrency(amount, revenue.currency);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Business performance — ${range.label.toLowerCase()}`}
      />

      {/* Date filter. Every figure below uses the selected range, except
          "Upcoming trips", which is an operations number. */}
      <form method="get" className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div>
          <Label htmlFor="range">Period</Label>
          <Select id="range" name="range" defaultValue={query.range}>
            {RANGES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
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
          Apply
        </button>
        <p className="ml-auto text-xs text-slate-400">
          Dates apply to when a lead or booking was created.
        </p>
      </form>

      {metrics.leads.overdueFollowUps > 0 && (
        <Link
          href="/admin/leads?due=overdue"
          className="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 hover:bg-red-100"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            <strong>{metrics.leads.overdueFollowUps}</strong> follow-up
            {metrics.leads.overdueFollowUps === 1 ? " is" : "s are"} overdue.
          </span>
        </Link>
      )}

      {/* Money */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Gross booking value"
          value={money(revenue.grossBookingValue)}
          icon={<IndianRupee className="h-5 w-5" />}
          tone="green"
        />
        <StatCard
          label="Paid"
          value={money(revenue.paid)}
          icon={<Receipt className="h-5 w-5" />}
          tone="green"
        />
        <StatCard
          label="Pending payment"
          value={money(revenue.pending)}
          icon={<Wallet className="h-5 w-5" />}
          tone="amber"
        />
        <StatCard
          label="Average booking"
          value={money(revenue.averageBookingValue)}
          icon={<TrendingUp className="h-5 w-5" />}
        />
      </div>

      {/* Volume */}
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total leads" value={metrics.leads.total} icon={<ClipboardList className="h-5 w-5" />} tone="purple" />
        <StatCard label="New leads" value={metrics.leads.new} icon={<ClipboardList className="h-5 w-5" />} tone="purple" />
        <StatCard label="Qualified" value={metrics.leads.qualified} icon={<ClipboardList className="h-5 w-5" />} />
        <StatCard label="Bookings" value={metrics.bookings.total} icon={<CalendarCheck className="h-5 w-5" />} />
        <StatCard label="Confirmed" value={metrics.bookings.confirmed} icon={<CalendarCheck className="h-5 w-5" />} tone="green" />
        <StatCard label="Cancelled" value={metrics.bookings.cancelled} icon={<CalendarCheck className="h-5 w-5" />} tone="amber" />
        <StatCard label="Upcoming trips" value={metrics.bookings.upcomingTrips} icon={<Plane className="h-5 w-5" />} />
        <StatCard
          label="Lead → booking"
          value={`${metrics.conversion.rate}%`}
          icon={<Percent className="h-5 w-5" />}
          tone="purple"
        />
      </div>

      {revenue.refunded > 0 && (
        <p className="mt-3 text-xs text-slate-500">
          {money(revenue.refunded)} was refunded in this period and is excluded from the paid total.
        </p>
      )}

      {/* Trends */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 font-semibold text-slate-900">Revenue trend</h2>
          <LineChart
            points={trend.map((point) => ({ label: point.label, value: point.revenue }))}
            valueFormatter={money}
          />
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-semibold text-slate-900">Leads and bookings</h2>
          <LineChart
            points={trend.map((point) => ({ label: point.label, value: point.leads }))}
            color="#7c3aed"
          />
          <p className="mt-2 text-xs text-slate-500">Leads created per day</p>
          <div className="mt-4 border-t border-slate-100 pt-4">
            <LineChart
              points={trend.map((point) => ({ label: point.label, value: point.bookings }))}
              color="#0d9488"
              height={120}
            />
            <p className="mt-2 text-xs text-slate-500">Bookings created per day</p>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-1 font-semibold text-slate-900">Conversion funnel</h2>
          <p className="mb-4 text-xs text-slate-500">
            Percentages show how many carried through from the stage above.
          </p>
          <Funnel stages={funnel} />
        </Card>

        <Card className="p-5">
          <h2 className="mb-1 font-semibold text-slate-900">Lead sources</h2>
          <p className="mb-4 text-xs text-slate-500">
            Captured server-side from UTM parameters and ad click ids.
          </p>
          <BarList
            rows={sources.slice(0, 8).map((row) => ({
              label: leadSourceLabel(row.source),
              value: row.leads,
              secondary: row.bookings > 0 ? `${row.bookings} booked` : undefined,
            }))}
            color="#7c3aed"
            emptyMessage="No leads in this period"
          />
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-1 font-semibold text-slate-900">Booking sources</h2>
          <p className="mb-4 text-xs text-slate-500">Revenue by channel.</p>
          <BarList
            rows={sources
              .filter((row) => row.revenue > 0)
              .slice(0, 8)
              .map((row) => ({
                label: leadSourceLabel(row.source),
                value: row.revenue,
                secondary: `${row.bookings} booking${row.bookings === 1 ? "" : "s"}`,
              }))}
            valueFormatter={money}
            emptyMessage="No bookings in this period"
          />
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-semibold text-slate-900">Top packages</h2>
          <BarList
            rows={topPackages.map((row) => ({
              label: row.name,
              value: row.revenue,
              secondary: `${row.bookings} booking${row.bookings === 1 ? "" : "s"}`,
            }))}
            valueFormatter={money}
            emptyMessage="No bookings in this period"
          />
        </Card>
      </div>

      {/* Top destinations */}
      <Card className="mt-6 p-0">
        <div className="border-b border-slate-100 p-5">
          <h2 className="font-semibold text-slate-900">Top destinations</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Bookings and revenue come from booking records. Enquiries are matched on the destination
            name a visitor typed, so that column is approximate.
          </p>
        </div>
        {topDestinations.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-400">No activity in this period.</p>
        ) : (
          <TableWrap>
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Destination</th>
                <th className="px-4 py-3 font-medium">Enquiries</th>
                <th className="px-4 py-3 font-medium">Bookings</th>
                <th className="px-4 py-3 font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {topDestinations.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                  <td className="px-4 py-3 text-slate-600">{row.leads}</td>
                  <td className="px-4 py-3 text-slate-600">{row.bookings}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{money(row.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>

      {/* Recent bookings */}
      <Card className="mt-6 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Latest bookings</h2>
          <Link href="/admin/bookings" className="text-sm text-brand-600 hover:underline">
            View all
          </Link>
        </div>
        {recentBookings.length === 0 ? (
          <p className="text-sm text-slate-500">No bookings yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recentBookings.map((booking) => (
              <li key={booking.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {booking.customer.name}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {booking.bookingNumber} · {booking.package.name}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-slate-900">
                    {formatCurrency(toNumber(booking.totalAmount), booking.currency)}
                  </p>
                  <p className="mt-0.5 flex items-center justify-end gap-2">
                    <Badge tone={booking.paymentStatus === "PAID" ? "green" : "amber"}>
                      {booking.paymentStatus}
                    </Badge>
                    <span className="text-xs text-slate-400">{formatDate(booking.createdAt)}</span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
