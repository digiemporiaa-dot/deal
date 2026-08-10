import Link from "next/link";
import { Package, MapPin, CalendarCheck, Users, ClipboardList, IndianRupee, Wallet } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader, StatCard, Card } from "@/components/admin/ui";
import { formatCurrency, formatDate, toNumber } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [
    packages, destinations, bookings, customers, leads,
    revenueAgg, pendingPayments, recentBookings, recentLeads,
  ] = await Promise.all([
    prisma.travelPackage.count(),
    prisma.destination.count(),
    prisma.booking.count(),
    prisma.customer.count(),
    prisma.lead.count(),
    prisma.booking.aggregate({ _sum: { totalAmount: true }, where: { paymentStatus: "PAID" } }),
    prisma.booking.count({ where: { paymentStatus: "PENDING" } }),
    prisma.booking.findMany({ take: 5, orderBy: { createdAt: "desc" }, include: { customer: true, package: { select: { name: true } } } }),
    prisma.lead.findMany({ take: 5, orderBy: { createdAt: "desc" } }),
  ]);

  const revenue = toNumber(revenueAgg._sum.totalAmount);

  return (
    <div>
      <PageHeader title="Dashboard" description="Overview of your travel business" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Revenue" value={formatCurrency(revenue)} icon={<IndianRupee className="h-5 w-5" />} tone="green" />
        <StatCard label="Bookings" value={bookings} icon={<CalendarCheck className="h-5 w-5" />} />
        <StatCard label="Pending Payments" value={pendingPayments} icon={<Wallet className="h-5 w-5" />} tone="amber" />
        <StatCard label="Leads" value={leads} icon={<ClipboardList className="h-5 w-5" />} tone="purple" />
        <StatCard label="Packages" value={packages} icon={<Package className="h-5 w-5" />} />
        <StatCard label="Destinations" value={destinations} icon={<MapPin className="h-5 w-5" />} />
        <StatCard label="Customers" value={customers} icon={<Users className="h-5 w-5" />} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Recent Bookings</h2>
            <Link href="/admin/bookings" className="text-sm text-brand-600 hover:underline">View all</Link>
          </div>
          {recentBookings.length === 0 ? (
            <p className="text-sm text-slate-500">No bookings yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentBookings.map((b) => (
                <li key={b.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{b.customer.name}</p>
                    <p className="truncate text-xs text-slate-500">{b.package.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">{formatCurrency(toNumber(b.totalAmount), b.currency)}</p>
                    <p className="text-xs text-slate-400">{formatDate(b.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Recent Leads</h2>
            <Link href="/admin/leads" className="text-sm text-brand-600 hover:underline">View all</Link>
          </div>
          {recentLeads.length === 0 ? (
            <p className="text-sm text-slate-500">No leads yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentLeads.map((l) => (
                <li key={l.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{l.name}</p>
                    <p className="truncate text-xs text-slate-500">{l.destination || l.phone}</p>
                  </div>
                  <Badge tone={l.status === "NEW" ? "brand" : "slate"}>{l.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
