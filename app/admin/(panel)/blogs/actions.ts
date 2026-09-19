"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { guardAction } from "@/lib/guard";
import { publishBlocked } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity";
import { createSlugRedirect } from "@/lib/redirects";
import { toSafeError } from "@/lib/errors";
import { sanitizeHtml } from "@/lib/sanitize";
import { blogSchema, type BlogInput } from "@/lib/validation";
import { slugify, serializeList } from "@/lib/utils";

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string; issues?: Record<string, string[]> };

async function uniqueSlug(base: string, ignoreId?: string): Promise<string> {
  const root = slugify(base) || "post";
  let candidate = root;
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await prisma.blogPost.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!existing || existing.id === ignoreId) return candidate;
    candidate = `${root}-${++n}`;
  }
}

export async function saveBlog(input: BlogInput, id?: string): Promise<ActionResult> {
  const guard = await guardAction(id ? "blogs:update" : "blogs:create");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = blogSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", issues: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;

  try {
    const before = id
      ? await prisma.blogPost.findUnique({
          where: { id },
          select: { slug: true, status: true, featured: true, publishedAt: true, title: true },
        })
      : null;
    if (id && !before) return { ok: false, error: "Post not found." };

    const publishError = publishBlocked(
      guard.actor.role,
      "blogs:publish",
      before ? before.status !== d.status || before.featured !== d.featured : d.status === "PUBLISHED",
    );
    if (publishError) return { ok: false, error: publishError };

    const slug = await uniqueSlug(d.slug || d.title, id);
    const data = {
      title: d.title,
      slug,
      excerpt: d.excerpt || null,
      // Editor-authored HTML is sanitised before it is ever stored.
      content: sanitizeHtml(d.content),
      coverImage: d.coverImage || null,
      tags: serializeList(d.tags),
      categoryId: d.categoryId || null,
      destinationId: d.destinationId || null,
      packageId: d.packageId || null,
      status: d.status,
      featured: d.featured,
      seoTitle: d.seoTitle || null,
      seoDescription: d.seoDescription || null,
      // Keep the original publication date across later edits.
      publishedAt:
        d.status === "PUBLISHED" ? (before?.publishedAt ?? new Date()) : null,
    };

    if (id) {
      await prisma.blogPost.update({ where: { id }, data });
    } else {
      const created = await prisma.blogPost.create({ data: { ...data, authorId: guard.actor.id } });
      id = created.id;
    }

    if (before && before.slug !== slug) {
      await createSlugRedirect({
        oldPath: `/blog/${before.slug}`,
        newPath: `/blog/${slug}`,
        note: `Blog slug changed from ${before.slug}`,
      });
    }

    await recordActivity({
      actor: guard.actor,
      action: before ? "UPDATE" : "CREATE",
      entity: "BlogPost",
      entityId: id,
      description: `${before ? "Updated" : "Created"} blog post "${d.title}"`,
      metadata: {
        slug,
        status: before && before.status !== d.status ? { from: before.status, to: d.status } : d.status,
      },
    });

    revalidatePath("/admin/blogs");
    revalidatePath("/blog");
    revalidatePath(`/blog/${slug}`);
    if (before && before.slug !== slug) revalidatePath(`/blog/${before.slug}`);
    return { ok: true, id: id! };
  } catch (err) {
    return { ok: false, error: toSafeError(err, "action.saveBlog", { id }).message };
  }
}

export async function deleteBlog(id: string): Promise<ActionResult> {
  const guard = await guardAction("blogs:delete");
  if (!guard.ok) return { ok: false, error: guard.error };
  try {
    const post = await prisma.blogPost.findUnique({ where: { id }, select: { title: true, slug: true } });
    if (!post) return { ok: false, error: "Post not found." };

    await prisma.blogPost.delete({ where: { id } });

    await recordActivity({
      actor: guard.actor,
      action: "DELETE",
      entity: "BlogPost",
      entityId: id,
      description: `Deleted blog post "${post.title}"`,
      metadata: { slug: post.slug },
    });

    revalidatePath("/admin/blogs");
    revalidatePath("/blog");
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: toSafeError(err, "action.deleteBlog", { id }).message };
  }
}
