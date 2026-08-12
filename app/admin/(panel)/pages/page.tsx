"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { slugify } from "@/lib/utils";

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string; issues?: Record<string, string[]> };

const sectionSchema = z.object({
  heading: z.string().default(""),
  level: z.enum(["h1", "h2", "h3", "h4", "h5", "h6"]).default("h2"),
  body: z.string().default(""),
});

const pageSchema = z.object({
  title: z.string().min(2, "Title is required").max(200),
  slug: z.string().optional().or(z.literal("")),
  sections: z.array(sectionSchema).default([]),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("PUBLISHED"),
  seoTitle: z.string().max(160).optional().or(z.literal("")),
  seoDescription: z.string().max(300).optional().or(z.literal("")),
  ogImage: z.string().optional().or(z.literal("")),
  faqs: z
    .array(z.object({ question: z.string(), answer: z.string() }))
    .default([]),
});

export type PageInput = z.infer<typeof pageSchema>;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isEmptyHtml(html: string): boolean {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim() === "";
}

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

const CONTENT_ROLES = ["SUPER_ADMIN", "ADMIN", "CONTENT_MANAGER"];

export async function savePage(input: PageInput, id?: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authorized." };
  if (!CONTENT_ROLES.includes(session.user.role || "")) {
    return { ok: false, error: "Your role cannot edit pages." };
  }

  const parsed = pageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", issues: parsed.error.flatten().fieldErrors };
  const d = parsed.data;

  // Keep only sections that actually have something in them.
  const sections = d.sections
    .map((s) => ({ heading: s.heading.trim(), level: s.level, body: s.body }))
    .filter((s) => s.heading !== "" || !isEmptyHtml(s.body));

  if (sections.length === 0) {
    return { ok: false, error: "Please add at least one section with a heading or some content." };
  }

  // Build the final page HTML from the sections.
  const content = sections
    .map((s) => {
      const headingHtml = s.heading ? `<${s.level}>${escapeHtml(s.heading)}</${s.level}>` : "";
      const bodyHtml = isEmptyHtml(s.body) ? "" : s.body;
      return headingHtml + bodyHtml;
    })
    .join("\n");

  const slug = await uniqueSlug(d.slug || d.title, id);
  const data = {
    title: d.title,
    slug,
    content,
    sections: JSON.stringify(sections),
    status: d.status,
    seoTitle: d.seoTitle || null,
    seoDescription: d.seoDescription || null,
    ogImage: d.ogImage || null,
  };

  const faqs = d.faqs
    .map((f) => ({ question: f.question.trim(), answer: f.answer.trim() }))
    .filter((f) => f.question && f.answer);

  try {
    if (id) {
      await prisma.page.update({ where: { id }, data });
    } else {
      const created = await prisma.page.create({ data });
      id = created.id;
    }
    // Replace the page's FAQs with the submitted list.
    await prisma.faq.deleteMany({ where: { pageId: id } });
    if (faqs.length > 0) {
      await prisma.faq.createMany({
        data: faqs.map((f, i) => ({ ...f, pageId: id!, sortOrder: i, published: true })),
      });
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
  if (!CONTENT_ROLES.includes(session.user.role || "")) {
    return { ok: false, error: "Your role cannot edit pages." };
  }
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
