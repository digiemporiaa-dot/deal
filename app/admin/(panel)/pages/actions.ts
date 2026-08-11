"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { slugify } from "@/lib/utils";

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string; issues?: Record<string, string[]> };

const pageSchema = z.object({
  title: z.string().min(2, "Title is required").max(200),
  slug: z.string().optional().or(z.literal("")),
  content: z.string().min(1, "Content is required"),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("PUBLISHED"),
  seoTitle: z.string().max(160).optional().or(z.literal("")),
  seoDescription: z.string().max(300).optional().or(z.literal("")),
});

export type PageInput = z.infer<typeof pageSchema>;

async function uniqueSlug(base: string, ignoreId?: string): Promise<string> {
  const root = slugify(base);
  let candidate = root;
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await prisma.page.findUnique({ where: { slug: candidate } });
    if (!existing || existing.id === ignoreId) return candidate;
    candidate = `${root}-${++n}`;
  }
}

export async function savePage(input: PageInput, id?: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authorized." };

  const parsed = pageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", issues: parsed.error.flatten().fieldErrors };
  const d = parsed.data;

  const slug = await uniqueSlug(d.slug || d.title, id);
  const data = {
    title: d.title,
    slug,
    content: d.content,
    status: d.status,
    seoTitle: d.seoTitle || null,
    seoDescription: d.seoDescription || null,
  };

  try {
    if (id) {
      await prisma.page.update({ where: { id }, data });
    } else {
      const created = await prisma.page.create({ data });
      id = created.id;
    }
    revalidatePath("/admin/pages");
    revalidatePath(`/${slug}`);
    return { ok: true, id: id! };
  } catch (err) {
    console.error("[savePage]", err);
    return { ok: false, error: "Something went wrong while saving the page." };
  }
}

export async function deletePage(id: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authorized." };
  try {
    const page = await prisma.page.delete({ where: { id } });
    revalidatePath("/admin/pages");
    revalidatePath(`/${page.slug}`);
    return { ok: true, id };
  } catch (err) {
    console.error("[deletePage]", err);
    return { ok: false, error: "Something went wrong while deleting the page." };
  }
}

