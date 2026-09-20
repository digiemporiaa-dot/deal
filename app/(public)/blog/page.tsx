import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import Image from "next/image";
import Link from "next/link";
import { getBlogPosts } from "@/lib/services/catalog";
import { SectionHeading } from "@/components/site/Section";
import { formatDate } from "@/lib/utils";
import { getPopularDestinations } from "@/lib/related";
import { PopularDestinations } from "@/components/site/RelatedContent";
import { Reveal, Stagger, StaggerItem, HoverLift } from "@/components/motion/Reveal";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    path: "/blog",
    title: "Travel Blog",
    description: "Travel tips, destination guides and inspiration for your next journey.",
  });
}

export const dynamic = "force-dynamic";

export default async function BlogPage() {
  const [posts, popular] = await Promise.all([getBlogPosts(), getPopularDestinations(8)]);
  return (
    <div className="container-page py-14">
      <Reveal>
        <SectionHeading eyebrow="Read & explore" title="Travel Blog" subtitle="Guides, tips and inspiration from our travel experts." />
      </Reveal>
      {posts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-500">No posts yet.</p>
      ) : (
        <Stagger className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <StaggerItem key={post.id} className="h-full">
              <HoverLift>
                <Link href={`/blog/${post.slug}`} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <div className="relative aspect-[16/9] bg-slate-100">
                    {post.coverImage && <Image src={post.coverImage} alt={post.title} fill sizes="33vw" className="object-cover transition-transform group-hover:scale-105" />}
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    {post.category && <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">{post.category.name}</p>}
                    <h2 className="mt-2 line-clamp-2 font-display text-lg font-semibold text-slate-900 group-hover:text-brand-700">{post.title}</h2>
                    {post.excerpt && <p className="mt-2 line-clamp-2 text-sm text-slate-600">{post.excerpt}</p>}
                    <p className="mt-auto pt-3 text-xs text-slate-500">
                      {post.author?.name} · {post.publishedAt ? formatDate(post.publishedAt) : ""}
                    </p>
                  </div>
                </Link>
              </HoverLift>
            </StaggerItem>
          ))}
        </Stagger>
      )}

      {/* Sends readers from guides into the bookable catalogue. */}
      <Reveal>
        <PopularDestinations destinations={popular} title="Popular destinations" />
      </Reveal>
    </div>
  );
}
