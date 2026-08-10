import Link from "next/link";
import { Plus, Search, Package as PackageIcon } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader, Card, EmptyState, AdminButtonLink } from "@/components/admin/ui";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, toNumber } from "@/lib/utils";
import { PackageRowActions } from "@/components/admin/PackageRowActions";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function AdminPackagesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const where: Prisma.TravelPackageWhereInput = {};
  if (sp.q) where.name = { contains: sp.q };
  if (sp.status === "published") where.published = true;
  if (sp.status === "draft") where.published = false;

  const packages = await prisma.travelPackage.findMany({
    where,
    include: { destination: { select: { name: true } }, _count: { select: { bookings: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="Packages"
        description="Create and manage your travel packages"
        action={<AdminButtonLink href="/admin/packages/new"><Plus className="h-4 w-4" /> Add Package</AdminButtonLink>}
      />

      <Card className="mb-4 p-3">
        <form className="flex flex-wrap gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input name="q" defaultValue={sp.q} placeholder="Search packages…" className="h-10 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none" />
          </div>
          <select name="status" defaultValue={sp.status} className="h-10 rounded-lg border border-slate-300 px-3 text-sm">
            <option value="">All statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
          <button className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800">Filter</button>
        </form>
      </Card>

      {packages.length === 0 ? (
        <EmptyState
          title="No packages yet"
          description="Create your first travel package to start taking bookings."
          action={<AdminButtonLink href="/admin/packages/new"><Plus className="h-4 w-4" /> Add Package</AdminButtonLink>}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Package</th>
                  <th className="px-4 py-3">Destination</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Bookings</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {packages.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-400"><PackageIcon className="h-4 w-4" /></span>
                        <span className="font-medium text-slate-900">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.destination.name}</td>
                    <td className="px-4 py-3 text-slate-900">{formatCurrency(toNumber(p.discountPrice ?? p.startingPrice), p.currency)}</td>
                    <td className="px-4 py-3 text-slate-600">{p._count.bookings}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Badge tone={p.published ? "green" : "slate"}>{p.published ? "Published" : "Draft"}</Badge>
                        {p.featured && <Badge tone="amber">Featured</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <PackageRowActions id={p.id} slug={p.slug} published={p.published} featured={p.featured} />
                    </td>
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
