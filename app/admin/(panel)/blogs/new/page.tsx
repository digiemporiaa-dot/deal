import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/admin/ui";
import { BlogForm } from "@/components/admin/BlogForm";
import { requirePermission } from "@/lib/guard";

export const dynamic = "force-dynamic";

export default async function NewBlogPage() {
  await requirePermission("blogs:create");

  const [categories, destinations, packages] = await Promise.all([
    prisma.blogCategory.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.destination.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.travelPackage.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div>
      <PageHeader title="New Post" description="Write a new blog post" />
      <BlogForm categories={categories} destinations={destinations} packages={packages} />
    </div>
  );
}
