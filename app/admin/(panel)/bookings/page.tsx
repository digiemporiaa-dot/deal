import { prisma } from "@/lib/db";
import { PageHeader, Card, EmptyState } from "@/components/admin/ui";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatDate, toNumber } from "@/lib/utils";
import { BookingStatusSelect } from "@/components/admin/BookingStatusSelect";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const paymentTone: Record<string, "green" | "amber" | "red" | "slate"> = {
  PAID: "green",
  PENDING: "amber",
  FAILED: "red",
  REFUNDED: "slate",
  PARTIALLY_REFUNDED: "slate",
};

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; payment?: string }>;
}) {
  const sp = await searchParams;
  const where: Prisma.BookingWhereInput = {};
  if (sp.payment) where.paymentStatus = sp.payment;
  if (sp.q) where.OR = [
    { bookingNumber: { contains: sp.q } },
    { customer: { name: { contains: sp.q } } },
  ];

  const bookings = await prisma.booking.findMany({
    where,
    include: { customer: true, package: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader title="Bookings" description="Manage all customer bookings" />

      <Card className="mb-4 p-3">
        <form className="flex flex-wrap gap-2">
          <input name="q" defaultValue={sp.q} placeholder="Search booking # or customer…" className="h-10 min-w-[220px] flex-1 rounded-lg border border-slate-300 px-3 text-sm focus:border-brand-500 focus:outline-none" />
          <select name="payment" defaultValue={sp.payment} className="h-10 rounded-lg border border-slate-300 px-3 text-sm">
            <option value="">All payments</option>
            {["PAID", "PENDING", "FAILED", "REFUNDED"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800">Filter</button>
        </form>
      </Card>

      {bookings.length === 0 ? (
        <EmptyState title="No bookings yet" description="Confirmed and pending bookings will appear here." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Booking</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Package</th>
                  <th className="px-4 py-3">Travel</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{b.bookingNumber}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{b.customer.name}</p>
                      <p className="text-xs text-slate-500">{b.customer.phone}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{b.package.name}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(b.travelDate)}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{formatCurrency(toNumber(b.totalAmount), b.currency)}</td>
                    <td className="px-4 py-3"><Badge tone={paymentTone[b.paymentStatus]}>{b.paymentStatus}</Badge></td>
                    <td className="px-4 py-3"><BookingStatusSelect id={b.id} value={b.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
