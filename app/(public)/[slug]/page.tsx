import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { can } from "@/lib/guard";
import { resolveRedirect } from "@/lib/redirects";
import { buildMetadata, getSeoMeta, breadcrumbSchema, faqSchema, extraSchema } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";
import { Faqs } from "@/components/site/Faqs";
import { PreviewBanner } from "@/components/site/PreviewBanner";
import { RenderDocument, hasBuilderContent } from "@/components/builder/RenderDocument";
import { CMS_ROUTES } from "@/lib/builder/routes";
import { getSettings } from "@/lib/settings";

/**
 * Generic CMS page renderer (e.g. /about, /terms, /privacy). Matches a Page
 * record by slug. More specific routes (packages, destinations, blog, contact)
 * take priority over this catch-all single segment.
 *
 * Signed-in admin users can also open a DRAFT page by adding ?preview=1.
 * If no page matches, a saved redirect for this path is honoured before 404.
 */
type Params = { params: Promise<{ slug: string }>; searchParams: Promise<{ preview?: string }> };

async function getPage(slug: string, allowDraft: boolean) {
  return prisma.page.findFirst({
    where: allowDraft ? { slug } : { slug, status: "PUBLISHED" },
    include: { faqs: { where: { published: true }, orderBy: { sortOrder: "asc" } } },
  });
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPage(slug, false);
  if (!page) return { title: "Page not found", robots: { index: false, follow: false } };

  const overrides = await getSeoMeta("PAGE", page.id);
  return buildMetadata(
    {
      path: `/${page.slug}`,
      title: page.seoTitle || page.title,
      description: page.seoDescription,
      image: page.ogImage,
      updatedAt: page.updatedAt,
    },
    overrides,
  );
}

export default async function CmsPage({ params, searchParams }: Params) {
  const { slug } = await params;
  const sp = await searchParams;

  // A page that backs a code route (the homepage, contact) is served there.
  // Leaving it reachable at both addresses would put two URLs with identical
  // content into the index, competing for the same search result.
  if (CMS_ROUTES[slug]) permanentRedirect(CMS_ROUTES[slug]);

  // Draft preview needs the permission, not merely a session: a signed-in
  // customer must not be able to read unpublished copy by guessing the URL.
  const allowDraft = sp.preview === "1" ? await can("pages:view") : false;

  const page = await getPage(slug, allowDraft);

  if (!page) {
    // Before giving up, honour a redirect the team saved for this address.
    // resolveRedirect() follows chains and refuses loops.
    const rule = await resolveRedirect(`/${slug}`);
    if (rule) {
      if (rule.statusCode === 301 || rule.statusCode === 308) permanentRedirect(rule.target);
      redirect(rule.target);
    }
    notFound();
  }

  const isDraft = page.status !== "PUBLISHED";
  const overrides = await getSeoMeta("PAGE", page.id);

  // A draft is only ever visible to a signed-in admin, so its FAQs are not
  // public content and must not be published as structured data.
  const schema = [
    breadcrumbSchema([
      { name: "Home", path: "/" },
      { name: page.title, path: `/${page.slug}` },
    ]),
    ...(page.faqs.length > 0 && !isDraft ? [faqSchema(page.faqs)!] : []),
    ...(isDraft ? [] : extraSchema(overrides?.schemaJson)),
  ];

  // A page built with the page builder renders from its document. Previewing
  // shows the draft; visitors always get the published copy, so editing never
  // changes the live page until someone publishes it.
  const builderContent = isDraft || sp.preview === "1" ? page.draftContent : page.publishedContent;

  if (hasBuilderContent(builderContent)) {
    const settings = await getSettings();
    return (
      <>
        {isDraft && <PreviewBanner title={page.title} editHref={`/admin/pages/${page.id}/builder`} />}
        {!isDraft && <JsonLd data={schema} />}
        <RenderDocument content={builderContent} ctx={{ whatsappNumber: settings.whatsapp }} />
      </>
    );
  }

  // Pages written before the builder keep rendering exactly as they did.
  return (
    <>
      {isDraft && <PreviewBanner title={page.title} editHref={`/admin/pages/${page.id}`} />}
      <div className="container-page max-w-3xl py-14">
        {!isDraft && <JsonLd data={schema} />}
        <h1 className="font-display text-4xl font-bold text-slate-900">{page.title}</h1>
        <div className="prose-content mt-6" dangerouslySetInnerHTML={{ __html: page.content }} />
        {page.faqs.length > 0 && (
          <div className="mt-12">
            <h2 className="mb-4 text-2xl font-bold text-slate-900">FAQs</h2>
            <Faqs items={page.faqs} />
          </div>
        )}
      </div>
    </>
  );
}
