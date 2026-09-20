import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getBlogPostBySlug } from "@/lib/services/catalog";
import { formatDate } from "@/lib/utils";
import { excerptFrom } from "@/lib/sanitize";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  buildMetadata,
  getSeoMeta,
  articleSchema,
  breadcrumbSchema,
  extraSchema,
} from "@/lib/seo";
import { EnquiryButton } from "@/components/enquiry/EnquiryButton";
import { getRelatedBlogs, getRelatedPackages, getRelatedDestinations } from "@/lib/related";
import { RelatedBlogs, RelatedPackages, RelatedDestinations } from "@/components/site/RelatedContent";
import { Reveal } from "@/components/motion/Reveal";
import { HeroIntro, HeroLine } from "@/components/motion/Hero";
import { parseList } from "@/lib/utils";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);
  if (!post) return { title: "Post not found", robots: { index: false, follow: false } };

  const overrides = await getSeoMeta("BLOG", post.id);
  return buildMetadata(
    {
      path: `/blog/${post.slug}`,
      title: post.seoTitle || post.title,
      description: post.seoDescription || post.excerpt || excerptFrom(post.content, 158),
      image: post.coverImage,
      publishedAt: post.publishedAt,
      updatedAt: post.updatedAt,
      type: "article",
    },
    overrides,
  );
}

export default async function BlogPostPage({ params }: Params) {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);
  if (!post) notFound();

  const tags = parseList(post.tags);

  const [overrides, article, relatedPosts, relatedPackages, relatedDestinations] = await Promise.all([
    getSeoMeta("BLOG", post.id),
    articleSchema({
      title: post.title,
      description: post.excerpt || excerptFrom(post.content, 200),
      path: `/blog/${post.slug}`,
      image: post.coverImage,
      authorName: post.author?.name ?? null,
      publishedAt: post.publishedAt,
      updatedAt: post.updatedAt,
    }),
    getRelatedBlogs({
      excludeId: post.id,
      destinationId: post.destinationId,
      packageId: post.packageId,
      categoryId: post.categoryId,
      tags,
      limit: 3,
    }),
    // A guide about a destination should lead somewhere bookable.
    post.destinationId
      ? getRelatedPackages({
          packageId: post.packageId ?? "",
          destinationId: post.destinationId,
          tags,
          limit: 3,
        })
      : Promise.resolve([]),
    post.destination
      ? getRelatedDestinations({
          destinationId: post.destination.id,
          country: post.destination.country,
          limit: 4,
        })
      : Promise.resolve([]),
  ]);

  return (
    <article className="container-page max-w-3xl py-14">
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Travel Guides", path: "/blog" },
            { name: post.title, path: `/blog/${post.slug}` },
          ]),
          article,
          ...extraSchema(overrides?.schemaJson),
        ]}
      />
      <HeroIntro>
        {post.category && <HeroLine as="p" className="text-sm font-semibold uppercase tracking-wide text-brand-600">{post.category.name}</HeroLine>}
        <HeroLine as="h1" className="mt-2 font-display text-4xl font-bold text-slate-900">{post.title}</HeroLine>
        <HeroLine as="p" className="mt-3 text-sm text-slate-500">
          {post.author?.name} · {post.publishedAt ? formatDate(post.publishedAt) : ""}
        </HeroLine>
        {post.coverImage && (
          <HeroLine className="relative mt-6 aspect-[16/9] overflow-hidden rounded-2xl bg-slate-100">
            <Image src={post.coverImage} alt={post.title} fill priority sizes="(max-width:768px) 100vw, 768px" className="object-cover" />
          </HeroLine>
        )}
      </HeroIntro>
      <div className="prose-content mt-8" dangerouslySetInnerHTML={{ __html: post.content }} />

      <Reveal className="mt-12 rounded-2xl bg-brand-50 p-6 text-center">
        <h3 className="text-lg font-semibold text-slate-900">Inspired to travel?</h3>
        <p className="mt-1 text-sm text-slate-600">Let our experts plan your perfect trip.</p>
        <EnquiryButton label="Plan My Trip" title="Plan My Trip" className="mt-4" />
      </Reveal>

      <Reveal>
        <RelatedPackages
          packages={relatedPackages}
          title={post.destination ? `Packages in ${post.destination.name}` : "Packages you can book"}
        />
      </Reveal>
      <Reveal>
        <RelatedDestinations destinations={relatedDestinations} title="Where to go next" />
      </Reveal>
      <Reveal>
        <RelatedBlogs posts={relatedPosts} title="More travel guides" />
      </Reveal>
    </article>
  );
}
