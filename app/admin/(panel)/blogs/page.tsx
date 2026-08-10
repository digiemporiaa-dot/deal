import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader, Card, EmptyState, AdminButtonLink } from "@/components/admin/ui";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import { BlogRowActions } from "@/components/admin/BlogRowActions";

export const dynamic = "force-dynamic";

export default async function AdminBlogsPage() {
  const posts = await prisma.blogPost.findMany({ include: { category: true }, orderBy: { createdAt: "desc" } });
  return (
    <div>
      <PageHeader title="Blog" description="Write and manage blog posts" action={<AdminButtonLink href="/admin/blogs/new"><Plus className="h-4 w-4" /> New Post</AdminButtonLink>} />
      {posts.length === 0 ? (
        <EmptyState title="No posts yet" description="Publish travel guides and tips to attract visitors." action={<AdminButtonLink href="/admin/blogs/new"><Plus className="h-4 w-4" /> New Post</AdminButtonLink>} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-3">Title</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Date</th><th className="px-4 py-3 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {posts.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{p.title}{p.featured && <Badge tone="amber" className="ml-2">Featured</Badge>}</td>
                    <td className="px-4 py-3 text-slate-600">{p.category?.name || "—"}</td>
                    <td className="px-4 py-3"><Badge tone={p.status === "PUBLISHED" ? "green" : "slate"}>{p.status}</Badge></td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(p.createdAt)}</td>
                    <td className="px-4 py-3"><BlogRowActions id={p.id} slug={p.slug} published={p.status === "PUBLISHED"} /></td>
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
