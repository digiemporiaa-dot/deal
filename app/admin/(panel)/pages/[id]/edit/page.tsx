import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/admin/ui";
import { PageForm } from "@/components/admin/PageForm";

export const dynamic = "force-dynamic";

type Section = { heading: string; level: "h1" | "h2" | "h3" | "h4" | "h5" | "h6"; body: string };

function parseSections(raw: string | null, fallbackContent: string): Section[] {
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Section[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((s) => ({
          heading: s.heading || "",
          level: s.level || "h2",
          body: s.body || "<p></p>",
        }));
      }
    } catch {
      // fall through to fallback
    }
  }
  // Older pages saved before sections existed: load the whole content as one section.
  return [{ heading: "", level: "h2", body: fallbackContent || "<p></p>" }];
}

export default async function EditPagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const page = await prisma.page.findUnique({
    where: { id },
    include: { faqs: { orderBy: { sortOrder: "asc" } } },
  });
  if (!page) notFound();

  const initial = {
    title: page.title,
    slug: page.slug,
    status: page.status as "DRAFT" | "PUBLISHED",
    seoTitle: page.seoTitle ?? "",
    seoDescription: page.seoDescription ?? "",
    ogImage: page.ogImage ?? "",
    sections: parseSections(page.sections, page.content),
    faqs: page.faqs.map((f: { question: string; answer: string }) => ({ question: f.question, answer: f.answer })),
  };

  return (
    <div>
      <PageHeader title="Edit Page" description={page.title} />
      <PageForm initial={initial} pageId={page.id} />
    </div>
  );
}
