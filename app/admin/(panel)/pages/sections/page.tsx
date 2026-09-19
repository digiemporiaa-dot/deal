import Link from "next/link";
import { ArrowLeft, Recycle } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePermission, can } from "@/lib/guard";
import { parseDocument } from "@/lib/builder/schema";
import { countNodes } from "@/lib/builder/tree";
import { formatDate } from "@/lib/utils";
import { PageHeader, Card, EmptyState } from "@/components/admin/ui";
import { DeleteReusableButton } from "@/components/builder/editor/LibraryActions";

export const dynamic = "force-dynamic";

/**
 * Reusable sections.
 *
 * A page that uses one stores only a reference, so editing the section here
 * changes every page that embeds it.
 */
export default async function ReusableSectionsPage() {
  await requirePermission("pages:view");

  const [sections, canDelete] = await Promise.all([
    prisma.reusableSection.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        content: true,
        updatedAt: true,
        createdBy: { select: { name: true } },
      },
    }),
    can("pages:delete"),
  ]);

  return (
    <div>
      <Link
        href="/admin/pages"
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" /> Pages
      </Link>

      <PageHeader
        title="Reusable sections"
        description="Build a section once and use it on many pages. Editing it here updates every page that embeds it."
      />

      {sections.length === 0 ? (
        <EmptyState
          title="No reusable sections yet"
          description="In the builder, select a section and use the Save as reusable control in the toolbar."
        />
      ) : (
        <Card className="divide-y divide-slate-100 p-0">
          {sections.map((section) => {
            const document = parseDocument(section.content);
            return (
              <div key={section.id} className="flex flex-wrap items-center gap-3 p-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
                  <Recycle className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">{section.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {countNodes(document)} elements · updated {formatDate(section.updatedAt)}
                    {section.createdBy?.name ? ` · by ${section.createdBy.name}` : ""}
                  </p>
                  {section.description && (
                    <p className="mt-1 text-xs text-slate-400">{section.description}</p>
                  )}
                </div>
                {canDelete && <DeleteReusableButton id={section.id} name={section.name} />}
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
