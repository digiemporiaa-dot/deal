import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/admin/ui";
import { PageForm } from "@/components/admin/PageForm";

export const dynamic = "force-dynamic";

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
    faqs: page.faqs.map((f) => ({ question: f.question, answer: f.answer })),
  };

  return (
    <div>
      <PageHeader title="Edit Page" description={page.title} />
      <PageForm initial={initial} initialContent={page.content} pageId={page.id} />
    </div>
  );
}
