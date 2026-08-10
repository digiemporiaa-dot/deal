import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Faqs } from "@/components/site/Faqs";

/**
 * Generic CMS page renderer (e.g. /about, /terms, /privacy). Matches a Page
 * record by slug. More specific routes (packages, destinations, blog, contact)
 * take priority over this catch-all single segment.
 */
type Params = { params: Promise<{ slug: string }> };

async function getPage(slug: string) {
  return prisma.page.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: { faqs: { where: { published: true }, orderBy: { sortOrder: "asc" } } },
  });
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) return { title: "Page not found" };
  return {
    title: page.seoTitle || page.title,
    description: page.seoDescription || undefined,
    alternates: { canonical: `/${page.slug}` },
  };
}

export default async function CmsPage({ params }: Params) {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) notFound();

  return (
    <div className="container-page max-w-3xl py-14">
      <h1 className="font-display text-4xl font-bold text-slate-900">{page.title}</h1>
      <div className="prose-content mt-6" dangerouslySetInnerHTML={{ __html: page.content }} />
      {page.faqs.length > 0 && (
        <div className="mt-12">
          <h2 className="mb-4 text-2xl font-bold text-slate-900">FAQs</h2>
          <Faqs items={page.faqs} />
        </div>
      )}
    </div>
  );
}
