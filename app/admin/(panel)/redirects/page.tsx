import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/admin/ui";
import { RedirectManager } from "@/components/admin/RedirectManager";

export const dynamic = "force-dynamic";

export default async function RedirectsPage() {
  const rows = await prisma.redirect.findMany({ orderBy: { createdAt: "desc" } });
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
          permanent: r.permanent,
          isActive: r.isActive,
          hits: r.hits,
          note: r.note,
        }))}
      />
    </div>
  );
}
