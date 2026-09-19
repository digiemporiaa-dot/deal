import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/admin/ui";
import { BlogForm } from "@/components/admin/BlogForm";
import { parseList } from "@/lib/utils";
import type { PostStatus } from "@/types/db-enums";
import { SeoPanelLoader } from "@/components/admin/SeoPanelLoader";
import { requirePermission } from "@/lib/guard";

export const dynamic = "force-dynamic";

export default async function EditBlogPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("blogs:update");

  const { id } = await params;
  const [post, categories, destinations, packages] = await Promise.all([
    prisma.blogPost.findUnique({ where: { id } }),
    prisma.blogCategory.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.destination.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.travelPackage.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
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
    destinationId: post.destinationId ?? "",
    packageId: post.packageId ?? "",
  };

  return (
    <div>
      <PageHeader title="Edit Post" description={post.title} />
      <BlogForm
        categories={categories}
        destinations={destinations}
        packages={packages}
        initial={initial}
        initialContent={post.content}
        blogId={post.id}
      />
      <SeoPanelLoader entityType="BLOG" entityId={post.id} previewPath={`/blog/${post.slug}`} />
    </div>
  );
}
