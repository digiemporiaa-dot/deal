import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/guard";
import { hasPermission } from "@/lib/permissions";
import { parseDocument } from "@/lib/builder/schema";
import { PageBuilder } from "@/components/builder/editor/PageBuilder";

export const dynamic = "force-dynamic";

/**
 * The visual builder.
 *
 * A separate route from the rest of the admin panel, which is what keeps the
 * editor bundle — dnd-kit, the canvas, the settings panel — off every other
 * page in the app and off the public site entirely.
 */
export default async function BuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requirePermission("pages:update");

  const [page, templates, sections] = await Promise.all([
    prisma.page.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        seoTitle: true,
        seoDescription: true,
        ogImage: true,
        draftContent: true,
        publishedContent: true,
      },
    }),
    prisma.pageTemplate.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true, kind: true, category: true, content: true },
      take: 200,
    }),
    prisma.reusableSection.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, description: true },
      take: 200,
    }),
  ]);

  if (!page) notFound();

  // A page created before the builder has no draft yet; it opens empty and the
  // legacy content keeps rendering publicly until this one is published.
  const draft = parseDocument(page.draftContent ?? page.publishedContent);

  return (
    <PageBuilder
      page={{
        id: page.id,
        title: page.title,
        slug: page.slug,
        status: page.status,
        seoTitle: page.seoTitle ?? "",
        seoDescription: page.seoDescription ?? "",
        ogImage: page.ogImage ?? "",
        draft,
        hasPublished: Boolean(page.publishedContent),
      }}
      templates={templates}
      sections={sections}
      canPublish={hasPermission(actor.role, "pages:create")}
      canUseRestricted={hasPermission(actor.role, "settings:manage")}
    />
  );
}
