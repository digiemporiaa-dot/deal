import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getBlogPostBySlug } from "@/lib/services/catalog";
import { formatDate } from "@/lib/utils";
import { JsonLd } from "@/components/seo/JsonLd";
import { EnquiryButton } from "@/components/enquiry/EnquiryButton";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);
  if (!post) return { title: "Post not found" };
  return {
    title: post.seoTitle || post.title,
    description: post.seoDescription || post.excerpt || undefined,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.seoTitle || post.title,
      description: post.seoDescription || post.excerpt || undefined,
      images: post.coverImage ? [post.coverImage] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: Params) {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);
  if (!post) notFound();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  return (
    <article className="container-page max-w-3xl py-14">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: post.title,
          image: post.coverImage,
          datePublished: post.publishedAt?.toISOString(),
          author: { "@type": "Organization", name: "Vacationdeal" },
          mainEntityOfPage: `${siteUrl}/blog/${post.slug}`,
        }}
      />
      {post.category && <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">{post.category.name}</p>}
      <h1 className="mt-2 font-display text-4xl font-bold text-slate-900">{post.title}</h1>
      <p className="mt-3 text-sm text-slate-500">
        {post.author?.name} · {post.publishedAt ? formatDate(post.publishedAt) : ""}
      </p>
      {post.coverImage && (
        <div className="relative mt-6 aspect-[16/9] overflow-hidden rounded-2xl bg-slate-100">
          <Image src={post.coverImage} alt={post.title} fill priority sizes="(max-width:768px) 100vw, 768px" className="object-cover" />
        </div>
      )}
      <div className="prose-content mt-8" dangerouslySetInnerHTML={{ __html: post.content }} />

      <div className="mt-12 rounded-2xl bg-brand-50 p-6 text-center">
        <h3 className="text-lg font-semibold text-slate-900">Inspired to travel?</h3>
        <p className="mt-1 text-sm text-slate-600">Let our experts plan your perfect trip.</p>
        <EnquiryButton label="Plan My Trip" title="Plan My Trip" className="mt-4" />
      </div>
    </article>
  );
}
