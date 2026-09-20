import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/admin/ui";
import { RedirectManager } from "@/components/admin/RedirectManager";
import { requirePermission } from "@/lib/guard";

export const dynamic = "force-dynamic";

export default async function RedirectsPage() {
  // Defence in depth: the middleware checks the section, and the page
  // checks the permission itself.
  await requirePermission("redirects:view");

  const rows = await prisma.redirect.findMany({ orderBy: { createdAt: "desc" }, take: 500 });
  return (
    <div>
      <PageHeader
        title="URL Redirects"
        description="Keep old links working after you rename a page — protects your Google rankings"
      />
      <RedirectManager
        rows={rows.map((r) => ({
          id: r.id,
          source: r.source,
          target: r.target,
          statusCode: r.statusCode,
          isActive: r.isActive,
          hits: r.hits,
          note: r.note,
        }))}
      />
    </div>
  );
}
