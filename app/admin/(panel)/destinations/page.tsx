import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader, Card, EmptyState, AdminButtonLink } from "@/components/admin/ui";
import { Badge } from "@/components/ui/Badge";
import { DestinationRowActions } from "@/components/admin/DestinationRowActions";

export const dynamic = "force-dynamic";

export default async function AdminDestinationsPage() {
  const destinations = await prisma.destination.findMany({
    include: { _count: { select: { packages: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <PageHeader
        title="Destinations"
        description="Manage the destinations you offer"
        action={<AdminButtonLink href="/admin/destinations/new"><Plus className="h-4 w-4" /> Add Destination</AdminButtonLink>}
      />

      {destinations.length === 0 ? (
        <EmptyState title="No destinations yet" description="Add your first destination to group packages." action={<AdminButtonLink href="/admin/destinations/new"><Plus className="h-4 w-4" /> Add Destination</AdminButtonLink>} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Country</th>
                  <th className="px-4 py-3">Packages</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {destinations.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{d.name}</td>
                    <td className="px-4 py-3 text-slate-600">{d.country}</td>
                    <td className="px-4 py-3 text-slate-600">{d._count.packages}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Badge tone={d.isPublished ? "green" : "slate"}>{d.isPublished ? "Published" : "Draft"}</Badge>
                        {d.isFeatured && <Badge tone="amber">Featured</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3"><DestinationRowActions id={d.id} published={d.isPublished} featured={d.isFeatured} /></td>
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
