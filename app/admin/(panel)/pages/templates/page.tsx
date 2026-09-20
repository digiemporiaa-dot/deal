import Link from "next/link";
import { ArrowLeft, LayoutTemplate } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePermission, can } from "@/lib/guard";
import { parseDocument } from "@/lib/builder/schema";
import { countNodes } from "@/lib/builder/tree";
import { PageHeader, Card, EmptyState } from "@/components/admin/ui";
import { Badge } from "@/components/ui/Badge";
import { DeleteTemplateButton } from "@/components/builder/editor/LibraryActions";

export const dynamic = "force-dynamic";

/** The template library: whole-page layouts and single saved sections. */
export default async function TemplatesPage() {
  await requirePermission("pages:view");

  const [templates, canDelete] = await Promise.all([
    prisma.pageTemplate.findMany({
      orderBy: [{ kind: "asc" }, { category: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        kind: true,
        category: true,
        description: true,
        isBuiltIn: true,
        content: true,
      },
    }),
    can("pages:delete"),
  ]);

  return (
    <div>
      <Link
        href="/admin/pages"
        className="mb-4 inline-flex items-center gap-1 text-sm text-admin-text-muted hover:text-admin-text"
      >
        <ArrowLeft className="h-4 w-4" /> Pages
      </Link>

      <PageHeader
        title="Templates"
        description="Starting points for new pages and sections. Unlike a reusable section, a template is copied — editing it later does not change pages already built from it."
      />

      {templates.length === 0 ? (
        <EmptyState
          title="No templates yet"
          description="In the builder, use a section's Save as template control to add one."
        />
      ) : (
        <Card className="divide-y divide-admin-border p-0">
          {templates.map((template) => {
            const document = parseDocument(template.content);
            return (
              <div key={template.id} className="flex flex-wrap items-center gap-3 p-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-admin-muted text-admin-text-muted">
                  <LayoutTemplate className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-admin-text">
                    {template.name}
                    <Badge tone={template.kind === "page" ? "brand" : "slate"}>
                      {template.kind === "page" ? "Full page" : "Section"}
                    </Badge>
                    {template.isBuiltIn && <Badge tone="amber">Built in</Badge>}
                  </p>
                  <p className="mt-0.5 text-xs text-admin-text-muted">
                    {template.category} · {document.sections.length} section
                    {document.sections.length === 1 ? "" : "s"} · {countNodes(document)} elements
                  </p>
                  {template.description && (
                    <p className="mt-1 text-xs text-admin-text-subtle">{template.description}</p>
                  )}
                </div>
                {canDelete && !template.isBuiltIn && (
                  <DeleteTemplateButton id={template.id} name={template.name} />
                )}
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
