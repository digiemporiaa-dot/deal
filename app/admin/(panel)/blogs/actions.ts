"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin, auth } from "@/lib/auth";
import { blogSchema, type BlogInput } from "@/lib/validation";
import { slugify, serializeList } from "@/lib/utils";

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string; issues?: Record<string, string[]> };

async function uniqueSlug(base: string, ignoreId?: string): Promise<string> {
  const root = slugify(base);
  let candidate = root;
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await prisma.blogPost.findUnique({ where: { slug: candidate } });
    if (!existing || existing.id === ignoreId) return candidate;
    candidate = `${root}-${++n}`;
  }
}

export async function saveBlog(input: BlogInput, id?: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authorized." };

  const parsed = blogSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", issues: parsed.error.flatten().fieldErrors };
  const d = parsed.data;

  const slug = await uniqueSlug(d.slug || d.title, id);
  const data = {
    title: d.title,
    slug,
    excerpt: d.excerpt || null,
    content: d.content,
    coverImage: d.coverImage || null,
    tags: serializeList(d.tags),
    categoryId: d.categoryId || null,
    status: d.status,
    featured: d.featured,
    seoTitle: d.seoTitle || null,
    seoDescription: d.seoDescription || null,
    publishedAt: d.status === "PUBLISHED" ? new Date() : null,
  };

  try {
    if (id) {
      await prisma.blogPost.update({ where: { id }, data });
    } else {
      const created = await prisma.blogPost.create({ data: { ...data, authorId: session.user.id } });
      id = created.id;
    }
    revalidatePath("/admin/blogs");
    revalidatePath("/blog");
    return { ok: true, id: id! };
  } catch (err) {
    console.error("[saveBlog]", err);
    return { ok: false, error: "Could not save the post." };
  }
}

export async function deleteBlog(id: string) {
  try { await requireAdmin(); } catch { return { ok: false as const, error: "Not authorized" }; }
  await prisma.blogPost.delete({ where: { id } });
  revalidatePath("/admin/blogs");
  return { ok: true as const };
}
