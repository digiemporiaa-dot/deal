import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarCheck,
  ClipboardList,
  IndianRupee,
  Percent,
  Plane,
  Wallet,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePermission, currentUser } from "@/lib/guard";
import {
  getDashboardMetrics,
  getTrend,
  getSourceBreakdown,
  getTopPackages,
  getTopDestinations,
  getConversionFunnel,
  getComparison,
  getBookingStatusBreakdown,
} from "@/lib/analytics";
import { recentLeads } from "@/lib/services/crm";
import {
  followUpQueue,
  QUEUE_BUCKETS,
  BUCKET_LABELS,
  type QueueItem,
} from "@/lib/services/follow-up";
import { listActivity } from "@/lib/activity";
import { dashboardQuerySchema } from "@/lib/validation";
import { leadSourceLabel, leadStatusLabel } from "@/lib/crm";
import { hasPermission } from "@/lib/permissions";
import { formatCurrency, formatDate, toNumber } from "@/lib/utils";
import {
  PageHeader,
  StatCard,
  SectionCard,
  ChartCard,
  TableWrap,
  Thead,
  Tbody,
  Th,
  Td,
  StatusBadge,
  Avatar,
  Sparkline,
  EmptyState,
  AdminButtonLink,
  type Delta,
} from "@/components/admin/ui";
import { LineChart, BarList, Funnel, ShareBar, CHART_COLORS } from "@/components/admin/Charts";
import { DashboardFilters } from "@/components/admin/DashboardFilters";
import { FollowUpQueue } from "@/components/admin/FollowUpQueue";
import { leadStatusTone, bookingStatusTone, paymentStatusTone, humanStatus } from "@/lib/admin-status";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * The dashboard.
 *
 * Every figure comes from the database through `lib/analytics` aggregations —
 * counts and sums computed in Postgres, never a table loaded into the page
 * and reduced in JavaScript. An empty database therefore shows zeroes and
 * empty states, which is the honest answer, rather than plausible-looking
 * sample numbers.
 *
 * Comparisons are against the equivalent window immediately before the
 * selected one, and are omitted entirely where there is nothing to compare
 * against (all-time, or a previous period with no activity).
 */
export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("dashboard:view");
  const actor = await currentUser();

  const raw = await searchParams;
  const parsed = dashboardQuerySchema.safeParse({
    range: first(raw.range) ?? "30d",
    from: first(raw.from),
    to: first(raw.to),
  });
  const query = parsed.success ? parsed.data : dashboardQuerySchema.parse({});

  const metrics = await getDashboardMetrics(query);
  const { range, revenue } = metrics;

  const canSeeLeads = hasPermission(actor?.role, "leads:view");
  const canSeeBookings = hasPermission(actor?.role, "bookings:view");
  const canSeeActivity = hasPermission(actor?.role, "activity:view");

  const [
    trend,
    comparison,
    sources,
    topPackages,
    topDestinations,
    funnel,
    bookingMix,
    followUps,
    latestLeads,
    recentBookings,
    activity,
  ] = await Promise.all([
    getTrend(range),
    getComparison(range),
    getSourceBreakdown(range),
    getTopPackages(range),
    getTopDestinations(range),
    getConversionFunnel(range),
    getBookingStatusBreakdown(range),
    canSeeLeads
      ? followUpQueue(actor, { limit: 30 })
      : Promise.resolve({ items: [], counts: null, escalated: 0 }),
    canSeeLeads ? recentLeads(actor, 6) : Promise.resolve([]),
    canSeeBookings
      ? prisma.booking.findMany({
          take: 6,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            bookingNumber: true,
            createdAt: true,
            travelDate: true,
            totalAmount: true,
            currency: true,
            status: true,
            paymentStatus: true,
            customer: { select: { name: true } },
            package: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
    canSeeActivity ? listActivity({ perPage: 8 }) : Promise.resolve({ rows: [] }),
  ]);

  const money = (amount: number) => formatCurrency(amount, revenue.currency);

  /** A delta is only shown when the comparison is meaningful. */
  const delta = (percent: number | null, invert?: boolean): Delta | null =>
    comparison.comparable && percent !== null
      ? { percent, label: comparison.label, invert }
      : null;

  const revenueSeries = trend.map((point) => point.revenue);
  const leadSeries = trend.map((point) => point.leads);
  const bookingSeries = trend.map((point) => point.bookings);

  const hasAnyData = metrics.leads.total > 0 || metrics.bookings.total > 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard"
        description={`Business performance — ${range.label.toLowerCase()}`}
        meta={
          comparison.comparable
            ? `Compared with ${formatDate(comparison.previous.from)} – ${formatDate(comparison.previous.to)}`
            : "No earlier period to compare against"
        }
        action={<DashboardFilters range={query.range} from={query.from} to={query.to} />}
      />

      {metrics.leads.overdueFollowUps > 0 && (
        <Link
          href="/admin/leads?due=overdue"
          className="flex items-center gap-2.5 rounded-card border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800 transition-colors hover:bg-red-100"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            <strong>{metrics.leads.overdueFollowUps}</strong> follow-up
            {metrics.leads.overdueFollowUps === 1 ? " is" : "s are"} overdue.
          </span>
          <ArrowUpRight className="ml-auto h-4 w-4 shrink-0" />
        </Link>
      )}

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Gross bookings"
          value={money(revenue.grossBookingValue)}
          icon={<IndianRupee className="h-4 w-4" />}
          tone="green"
          delta={delta(comparison.revenue)}
          sparkline={<Sparkline points={revenueSeries} color={CHART_COLORS.success} />}
        />
        <StatCard
          label="Payments received"
          value={money(revenue.paid)}
          icon={<Wallet className="h-4 w-4" />}
          tone="green"
          delta={delta(comparison.paid)}
          href={canSeeBookings ? "/admin/payments" : undefined}
        />
        <StatCard
          label="Pending payment"
          value={money(revenue.pending)}
          icon={<Wallet className="h-4 w-4" />}
          tone="amber"
          hint={revenue.pending > 0 ? "Awaiting collection" : "Nothing outstanding"}
          href={canSeeBookings ? "/admin/payments?status=PENDING" : undefined}
        />
        <StatCard
          label="Leads"
          value={metrics.leads.total}
          icon={<ClipboardList className="h-4 w-4" />}
          tone="purple"
          delta={delta(comparison.leads)}
          sparkline={<Sparkline points={leadSeries} color={CHART_COLORS.secondary} />}
          href={canSeeLeads ? "/admin/leads" : undefined}
        />
        <StatCard
          label="Bookings"
          value={metrics.bookings.total}
          icon={<CalendarCheck className="h-4 w-4" />}
          tone="brand"
          delta={delta(comparison.bookings)}
          sparkline={<Sparkline points={bookingSeries} color={CHART_COLORS.primary} />}
          href={canSeeBookings ? "/admin/bookings" : undefined}
        />
        <StatCard
          label="Lead → booking"
          value={`${metrics.conversion.rate}%`}
          icon={<Percent className="h-4 w-4" />}
          tone="brand"
          delta={delta(comparison.conversion)}
          hint={`${metrics.conversion.bookings} of ${metrics.conversion.leads}`}
        />
      </div>

      {!hasAnyData && (
        <EmptyState
          icon={<Plane className="h-5 w-5" />}
          title="No activity in this period"
          description="Nothing was booked and no enquiries came in between these dates. Try a wider date range, or check back once the site starts receiving traffic."
          compact
        />
      )}

      {/* ── Trends ── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard
          title="Revenue overview"
          description={`Booked value per ${trend.length > 40 ? "month" : "day"}, ${range.label.toLowerCase()}`}
          className="xl:col-span-2"
          footer={
            revenue.refunded > 0
              ? `${money(revenue.refunded)} was refunded in this period and is excluded from payments received.`
              : undefined
          }
        >
          <LineChart
            points={trend.map((point) => ({ label: point.label, value: point.revenue }))}
            valueFormatter={money}
            height={230}
          />
        </ChartCard>

        <ChartCard title="Booking mix" description="Every booking created in this period">
          <ShareBar
            rows={bookingMix.map((row) => ({
              label: humanStatus(row.status),
              count: row.count,
              percent: row.percent,
              // Only the two states an operations lead scans for carry colour.
              color:
                row.status === "CONFIRMED" || row.status === "COMPLETED"
                  ? CHART_COLORS.success
                  : row.status === "CANCELLED"
                    ? CHART_COLORS.danger
                    : undefined,
            }))}
            emptyMessage="No bookings in this period"
          />
          <p className="mt-4 border-t border-admin pt-3 text-xs text-admin-text-muted">
            {metrics.bookings.upcomingTrips} trip
            {metrics.bookings.upcomingTrips === 1 ? "" : "s"} yet to depart — an operations figure, so
            it ignores the date filter.
          </p>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard title="Enquiries per day" description="New leads created">
          <LineChart
            points={trend.map((point) => ({ label: point.label, value: point.leads }))}
            color={CHART_COLORS.secondary}
            height={170}
            emptyMessage="No enquiries in this period"
          />
        </ChartCard>

        <ChartCard
          title="Lead pipeline"
          description="How far enquiries travelled before converting"
        >
          <Funnel stages={funnel} />
        </ChartCard>

        <ChartCard
          title="Where leads came from"
          description="Captured server-side from UTM parameters and ad click ids"
        >
          <BarList
            rows={sources.slice(0, 6).map((row) => ({
              label: leadSourceLabel(row.source),
              value: row.leads,
              secondary: row.bookings > 0 ? `${row.bookings} booked` : undefined,
            }))}
            color={CHART_COLORS.secondary}
            emptyMessage="No leads in this period"
          />
        </ChartCard>
      </div>

      {/* ── Operations ── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {canSeeLeads && (
          <SectionCard
            title="Follow-ups"
            description="Overdue first, then today, then the week ahead"
            action={
              <Link href="/admin/follow-ups" className="text-xs font-semibold text-brand-600 hover:underline">
                Open the queue
              </Link>
            }
            bodyClassName="p-0"
          >
            <FollowUpQueue variant="compact" groups={followUpGroups(followUps.items)} />
          </SectionCard>
        )}

        {canSeeLeads && (
          <SectionCard
            title="Latest enquiries"
            action={
              <Link href="/admin/leads" className="text-xs font-semibold text-brand-600 hover:underline">
                View all
              </Link>
            }
            bodyClassName="p-0"
          >
            {latestLeads.length === 0 ? (
              <p className="p-8 text-center text-sm text-admin-text-subtle">
                No enquiries yet. They will appear here as soon as someone submits the website form.
              </p>
            ) : (
              <ul className="divide-y divide-admin-border">
                {latestLeads.map((lead) => (
                  <li key={lead.id}>
                    <Link
                      href={`/admin/leads?lead=${lead.id}`}
                      className="flex items-center gap-3 px-5 py-2.5 hover:bg-admin-bg"
                    >
                      <Avatar name={lead.name} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-admin-text">
                          {lead.name}
                        </span>
                        <span className="block truncate text-[11px] text-admin-text-muted">
                          {[lead.contact, lead.destination].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <StatusBadge tone={leadStatusTone(lead.status)}>
                          {leadStatusLabel(lead.status)}
                        </StatusBadge>
                        <span className="mt-1 block text-[10px] text-admin-text-subtle">
                          {formatDate(lead.createdAt)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        )}

        {canSeeActivity && (
          <SectionCard
            title="Latest activity"
            action={
              <Link href="/admin/activity-log" className="text-xs font-semibold text-brand-600 hover:underline">
                View log
              </Link>
            }
            bodyClassName="p-0"
          >
            {activity.rows.length === 0 ? (
              <p className="p-8 text-center text-sm text-admin-text-subtle">
                Nothing has happened yet.
              </p>
            ) : (
              <ul className="divide-y divide-admin-border">
                {activity.rows.map((row) => (
                  <li key={row.id} className="flex gap-3 px-5 py-2.5">
                    <Avatar name={row.userName || "System"} size="xs" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] leading-snug text-admin-text">{row.description}</p>
                      <p className="mt-0.5 text-[11px] text-admin-text-subtle">
                        {row.userName || "System"} · {formatDate(row.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        )}
      </div>

      {/* ── Catalogue performance ── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SectionCard
          title="Top destinations"
          description="Bookings and revenue come from booking records. Enquiries are matched on the destination name a visitor typed, so that column is approximate."
          bodyClassName="p-0"
        >
          {topDestinations.length === 0 ? (
            <p className="p-8 text-center text-sm text-admin-text-subtle">
              No destination activity in this period.
            </p>
          ) : (
            <TableWrap minWidth={480}>
              <Thead>
                <tr>
                  <Th>Destination</Th>
                  <Th align="right">Enquiries</Th>
                  <Th align="right">Bookings</Th>
                  <Th align="right">Revenue</Th>
                </tr>
              </Thead>
              <Tbody>
                {topDestinations.map((row) => (
                  <tr key={row.id} className="hover:bg-admin-bg">
                    <Td className="font-medium text-admin-text">{row.name}</Td>
                    <Td align="right" className="tabular-nums">
                      {row.leads}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {row.bookings}
                    </Td>
                    <Td align="right" className="font-semibold tabular-nums text-admin-text">
                      {money(row.revenue)}
                    </Td>
                  </tr>
                ))}
              </Tbody>
            </TableWrap>
          )}
        </SectionCard>

        <SectionCard
          title="Top packages"
          description="Ranked by revenue booked in this period"
          action={
            <Link href="/admin/packages" className="text-xs font-semibold text-brand-600 hover:underline">
              All packages
            </Link>
          }
          bodyClassName="p-0"
        >
          {topPackages.length === 0 ? (
            <p className="p-8 text-center text-sm text-admin-text-subtle">
              No package sold in this period.
            </p>
          ) : (
            <TableWrap minWidth={480}>
              <Thead>
                <tr>
                  <Th>Package</Th>
                  <Th>Destination</Th>
                  <Th align="right">Bookings</Th>
                  <Th align="right">Revenue</Th>
                </tr>
              </Thead>
              <Tbody>
                {topPackages.map((row) => (
                  <tr key={row.id} className="hover:bg-admin-bg">
                    <Td className="font-medium text-admin-text">
                      <Link href={`/admin/packages/${row.id}/edit`} className="hover:text-brand-700">
                        {row.name}
                      </Link>
                    </Td>
                    <Td>{row.destination}</Td>
                    <Td align="right" className="tabular-nums">
                      {row.bookings}
                    </Td>
                    <Td align="right" className="font-semibold tabular-nums text-admin-text">
                      {money(row.revenue)}
                    </Td>
                  </tr>
                ))}
              </Tbody>
            </TableWrap>
          )}
        </SectionCard>
      </div>

      {/* ── Recent bookings ── */}
      {canSeeBookings && (
        <SectionCard
          title="Recent bookings"
          action={
            <AdminButtonLink href="/admin/bookings" tone="outline" size="sm">
              View all
            </AdminButtonLink>
          }
          bodyClassName="p-0"
        >
          {recentBookings.length === 0 ? (
            <p className="p-8 text-center text-sm text-admin-text-subtle">
              No bookings yet. They will appear here as soon as the first one is paid for.
            </p>
          ) : (
            <TableWrap minWidth={760}>
              <Thead>
                <tr>
                  <Th>Booking</Th>
                  <Th>Customer</Th>
                  <Th>Package</Th>
                  <Th>Travel date</Th>
                  <Th align="right">Amount</Th>
                  <Th>Payment</Th>
                  <Th>Status</Th>
                </tr>
              </Thead>
              <Tbody>
                {recentBookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-admin-bg">
                    <Td className="font-medium text-admin-text">
                      <Link href={`/admin/bookings?booking=${booking.id}`} className="hover:text-brand-700">
                        {booking.bookingNumber}
                      </Link>
                    </Td>
                    <Td>{booking.customer.name}</Td>
                    <Td className="max-w-[220px] truncate">{booking.package.name}</Td>
                    <Td>{formatDate(booking.travelDate)}</Td>
                    <Td align="right" className="font-semibold tabular-nums text-admin-text">
                      {formatCurrency(toNumber(booking.totalAmount), booking.currency)}
                    </Td>
                    <Td>
                      <StatusBadge tone={paymentStatusTone(booking.paymentStatus)} dot>
                        {humanStatus(booking.paymentStatus)}
                      </StatusBadge>
                    </Td>
                    <Td>
                      <StatusBadge tone={bookingStatusTone(booking.status)}>
                        {humanStatus(booking.status)}
                      </StatusBadge>
                    </Td>
                  </tr>
                ))}
              </Tbody>
            </TableWrap>
          )}
        </SectionCard>
      )}
    </div>
  );
}

/**
 * The queue as the card wants it: the three buckets that need acting on now,
 * dates serialised for the client component.
 *
 * "This week" and "Later" are left out on purpose — the dashboard card is for
 * what to do today, and the full queue at /admin/follow-ups is one click away
 * for the rest.
 */
function followUpGroups(items: QueueItem[]) {
  const shown = new Set(["overdue", "today", "tomorrow"]);
  return QUEUE_BUCKETS.filter((bucket) => shown.has(bucket)).map((bucket) => ({
    bucket,
    label: BUCKET_LABELS[bucket],
    items: items
      .filter((item) => item.bucket === bucket)
      .slice(0, 6)
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
}
