import { prisma } from "@/lib/db";
import { PageHeader, Card, EmptyState } from "@/components/admin/ui";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  const customers = await prisma.customer.findMany({
    where: sp.q ? { OR: [{ name: { contains: sp.q } }, { email: { contains: sp.q } }, { phone: { contains: sp.q } }] } : undefined,
    include: { _count: { select: { bookings: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader title="Customers" description="Everyone who has booked or enquired" />
      <Card className="mb-4 p-3">
        <form className="flex gap-2">
          <input name="q" defaultValue={sp.q} placeholder="Search customers…" className="h-10 flex-1 rounded-lg border border-slate-300 px-3 text-sm focus:border-brand-500 focus:outline-none" />
          <button className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white">Search</button>
        </form>
      </Card>
      {customers.length === 0 ? (
        <EmptyState title="No customers yet" />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Phone</th><th className="px-4 py-3">Location</th><th className="px-4 py-3">Bookings</th><th className="px-4 py-3">Joined</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                    <td className="px-4 py-3 text-slate-600">{c.email}</td>
                    <td className="px-4 py-3 text-slate-600">{c.phone}</td>
                    <td className="px-4 py-3 text-slate-500">{[c.city, c.country].filter(Boolean).join(", ") || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{c._count.bookings}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(c.createdAt)}</td>
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
