import Link from "next/link";
import { LayoutTemplate, Paintbrush, Plus, Recycle } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader, Card, EmptyState, AdminButtonLink } from "@/components/admin/ui";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import { parseDocument } from "@/lib/builder/schema";
import { countNodes } from "@/lib/builder/tree";
import { PageRowActions } from "@/components/admin/PageRowActions";
import { DuplicatePageButton } from "@/components/builder/editor/DuplicatePageButton";
import { NewPageButton } from "@/components/builder/editor/NewPageButton";
import { requirePermission, can } from "@/lib/guard";

export const dynamic = "force-dynamic";

export default async function AdminPagesPage() {
  // Defence in depth: the middleware checks the section, and the page
  // checks the permission itself.
  await requirePermission("pages:view");

  const [pages, templates, sectionCount, canCreate] = await Promise.all([
    prisma.page.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        updatedAt: true,
        publishedAt: true,
        draftContent: true,
        publishedContent: true,
        content: true,
        updatedBy: { select: { name: true } },
      },
    }),
    prisma.pageTemplate.findMany({
      where: { kind: "page" },
      orderBy: { name: "asc" },
      select: { slug: true, name: true, description: true },
    }),
    prisma.reusableSection.count(),
    can("pages:create"),
  ]);

  const drafts = pages.filter((page) => page.status !== "PUBLISHED").length;

  return (
    <div>
      <PageHeader
        title="Pages"
        description="Build and manage site pages visually — no code needed."
        action={
          canCreate ? (
            <NewPageButton templates={templates} />
          ) : undefined
        }
      />

      {/* CMS at a glance */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Total pages" value={pages.length} />
        <StatTile label="Published" value={pages.length - drafts} />
        <StatTile label="Drafts" value={drafts} />
        <StatTile label="Reusable sections" value={sectionCount} />
      </div>

      {pages.length === 0 ? (
        <EmptyState
          title="No pages yet"
          description="Create your first page and build it visually with sections and elements."
          action={canCreate ? <NewPageButton templates={templates} /> : undefined}
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b border-admin bg-admin-bg text-left text-xs uppercase tracking-wide text-admin-text-muted">
                <tr>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">URL</th>
                  <th className="px-4 py-3">Built with</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-border">
                {pages.map((page) => {
                  const draft = parseDocument(page.draftContent);
                  const published = parseDocument(page.publishedContent);
                  const usesBuilder = draft.sections.length > 0 || published.sections.length > 0;
                  // A draft ahead of the published copy is worth flagging: it
                  // means someone's work is not live yet.
                  const unpublished =
                    usesBuilder &&
                    page.status === "PUBLISHED" &&
                    JSON.stringify(draft) !== JSON.stringify(published);

                  return (
                    <tr key={page.id} className="hover:bg-admin-bg">
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/pages/${page.id}/builder`}
                          className="font-medium text-admin-text hover:text-brand-700"
                        >
                          {page.title}
                        </Link>
                        {unpublished && (
                          <span className="ml-2 text-[11px] font-medium text-amber-600">
                            Draft changes
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-admin-text-muted">/{page.slug}</td>
                      <td className="px-4 py-3">
                        {usesBuilder ? (
                          <span className="text-xs text-admin-text-muted">
                            Builder · {countNodes(draft.sections.length ? draft : published)} elements
                          </span>
                        ) : (
                          <span className="text-xs text-admin-text-subtle">Classic editor</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={page.status === "PUBLISHED" ? "green" : "slate"}>{page.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-admin-text-muted">
                        {formatDate(page.updatedAt)}
                        {page.updatedBy?.name && (
                          <span className="block text-xs text-admin-text-subtle">{page.updatedBy.name}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/admin/pages/${page.id}/builder`}
                            title="Open the visual builder"
                            className="inline-flex h-8 items-center gap-1 rounded-md bg-brand-600 px-2.5 text-xs font-semibold text-white hover:bg-brand-700"
                          >
                            <Paintbrush className="h-3.5 w-3.5" /> Build
                          </Link>
                          {canCreate && <DuplicatePageButton pageId={page.id} />}
                          <PageRowActions
                            id={page.id}
                            title={page.title}
                            slug={page.slug}
                            published={page.status === "PUBLISHED"}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        <Link
          href="/admin/pages/sections"
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-admin-border-strong bg-white px-4 font-semibold text-admin-text hover:bg-admin-bg"
        >
          <Recycle className="h-4 w-4" /> Reusable sections
        </Link>
        <Link
          href="/admin/pages/templates"
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-admin-border-strong bg-white px-4 font-semibold text-admin-text hover:bg-admin-bg"
        >
          <LayoutTemplate className="h-4 w-4" /> Templates
        </Link>
        <Link
          href="/admin/pages/new"
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-admin-border-strong bg-white px-4 font-semibold text-admin-text hover:bg-admin-bg"
        >
          <Plus className="h-4 w-4" /> Classic editor
        </Link>
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-admin bg-white p-4">
      <p className="text-sm text-admin-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-admin-text">{value}</p>
    </div>
  );
}
