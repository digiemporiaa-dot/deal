import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, History } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/guard";
import { parseDocument } from "@/lib/builder/schema";
import { countNodes } from "@/lib/builder/tree";
import { PageHeader, Card, EmptyState } from "@/components/admin/ui";
import { Badge } from "@/components/ui/Badge";
import { RestoreRevisionButton } from "@/components/builder/editor/RestoreRevisionButton";

export const dynamic = "force-dynamic";

const REASON_LABEL: Record<string, string> = {
  publish: "Published",
  manual: "Saved",
  restore: "Replaced by a restore",
  autosave: "Autosaved",
};

export default async function RevisionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePermission("pages:update");

  const [page, revisions] = await Promise.all([
    prisma.page.findUnique({ where: { id }, select: { id: true, title: true, slug: true } }),
    prisma.pageRevision.findMany({
      where: { pageId: id },
      orderBy: { version: "desc" },
      take: 50,
      select: {
        id: true,
        version: true,
        reason: true,
        note: true,
        content: true,
        createdAt: true,
        createdBy: { select: { name: true } },
      },
    }),
  ]);

  if (!page) notFound();

  return (
    <div>
      <Link
        href={`/admin/pages/${page.id}/builder`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-admin-text-muted hover:text-admin-text"
      >
        <ArrowLeft className="h-4 w-4" /> Back to the builder
      </Link>

      <PageHeader
        title="Revision history"
        description={`Earlier versions of "${page.title}". Restoring puts a version back into the draft — the live page only changes when you publish.`}
      />

      {revisions.length === 0 ? (
        <EmptyState
          title="No revisions yet"
          description="A revision is recorded every time the page is published, and whenever you save one by hand."
        />
      ) : (
        <Card className="divide-y divide-admin-border p-0">
          {revisions.map((revision, index) => {
            const document = parseDocument(revision.content);
            return (
              <div key={revision.id} className="flex flex-wrap items-center gap-3 p-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-admin-muted text-admin-text-muted">
                  <History className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium text-admin-text">
                    Version {revision.version}
                    {index === 0 && <Badge tone="brand">Latest</Badge>}
                    <Badge tone={revision.reason === "publish" ? "green" : "slate"}>
                      {REASON_LABEL[revision.reason] ?? revision.reason}
                    </Badge>
                  </p>
                  <p className="mt-0.5 text-xs text-admin-text-muted">
                    {revision.createdAt.toLocaleString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                    {revision.createdBy?.name ? ` · ${revision.createdBy.name}` : ""}
                    {" · "}
                    {document.sections.length} section{document.sections.length === 1 ? "" : "s"},{" "}
                    {countNodes(document)} elements
                  </p>
                  {revision.note && <p className="mt-1 text-xs text-admin-text-subtle">{revision.note}</p>}
                </div>
                <RestoreRevisionButton pageId={page.id} revisionId={revision.id} version={revision.version} />
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
