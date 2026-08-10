import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/admin/ui";
import { BlogForm } from "@/components/admin/BlogForm";
import { parseList } from "@/lib/utils";
import type { PostStatus } from "@/types/db-enums";

export const dynamic = "force-dynamic";

export default async function EditBlogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [post, categories] = await Promise.all([
    prisma.blogPost.findUnique({ where: { id } }),
    prisma.blogCategory.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!post) notFound();

  const initial = {
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt ?? "",
    coverImage: post.coverImage ?? "",
    categoryId: post.categoryId ?? "",
    status: post.status as PostStatus,
    featured: post.featured,
    tags: parseList(post.tags).join(", "),
    seoTitle: post.seoTitle ?? "",
    seoDescription: post.seoDescription ?? "",
  };

  return (
    <div>
      <PageHeader title="Edit Post" description={post.title} />
      <BlogForm categories={categories} initial={initial} initialContent={post.content} blogId={post.id} />
    </div>
  );
}
