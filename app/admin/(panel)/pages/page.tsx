import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader, Card, EmptyState, AdminButtonLink } from "@/components/admin/ui";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import { PageRowActions } from "@/components/admin/PageRowActions";

export const dynamic = "force-dynamic";

export default async function AdminPagesPage() {
  const pages = await prisma.page.findMany({ orderBy: { title: "asc" } });
  return (
    <div>
      <PageHeader title="Pages" description="Edit website pages like About, Terms and Privacy" action={<AdminButtonLink href="/admin/pages/new"><Plus className="h-4 w-4" /> New Page</AdminButtonLink>} />
      {pages.length === 0 ? (
        <EmptyState title="No pages yet" description="Create pages like About Us, Terms and Privacy Policy." action={<AdminButtonLink href="/admin/pages/new"><Plus className="h-4 w-4" /> New Page</AdminButtonLink>} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-3">Title</th><th className="px-4 py-3">URL</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Updated</th><th className="px-4 py-3 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pages.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{p.title}</td>
                    <td className="px-4 py-3 text-slate-600">/{p.slug}</td>
                    <td className="px-4 py-3"><Badge tone={p.status === "PUBLISHED" ? "green" : "slate"}>{p.status}</Badge></td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(p.updatedAt)}</td>
                    <td className="px-4 py-3"><PageRowActions id={p.id} slug={p.slug} published={p.status === "PUBLISHED"} /></td>
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

