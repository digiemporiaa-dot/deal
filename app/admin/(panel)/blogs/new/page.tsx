import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/admin/ui";
import { BlogForm } from "@/components/admin/BlogForm";

export const dynamic = "force-dynamic";

export default async function NewBlogPage() {
  const categories = await prisma.blogCategory.findMany({ orderBy: { name: "asc" } });
  return (
    <div>
      <PageHeader title="New Post" description="Write a new blog post" />
      <BlogForm categories={categories} />
    </div>
  );
}
