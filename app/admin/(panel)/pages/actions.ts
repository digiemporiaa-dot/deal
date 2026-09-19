"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { guardAction } from "@/lib/guard";
import { publishBlocked } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity";
import { createSlugRedirect } from "@/lib/redirects";
import { toSafeError } from "@/lib/errors";
import { sanitizeHtml } from "@/lib/sanitize";
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

export async function savePage(input: PageInput, id?: string): Promise<ActionResult> {
  const guard = await guardAction(id ? "pages:update" : "pages:create");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = pageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", issues: parsed.error.flatten().fieldErrors };
  const d = parsed.data;

  // Keep only sections that actually have something in them.
  // Rich-text bodies are sanitised before they are stored or rendered.
  const sections = d.sections
    .map((s) => ({ heading: s.heading.trim(), level: s.level, body: sanitizeHtml(s.body) }))
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

  const before = id
    ? await prisma.page.findUnique({ where: { id }, select: { slug: true, status: true, title: true } })
    : null;
  if (id && !before) return { ok: false, error: "Page not found." };

  const publishError = publishBlocked(
    guard.actor.role,
    "pages:create",
    before ? before.status !== d.status : d.status === "PUBLISHED",
  );
  if (publishError) return { ok: false, error: publishError };

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
    if (before && before.slug !== slug) {
      await createSlugRedirect({
        oldPath: `/${before.slug}`,
        newPath: `/${slug}`,
        note: `Page slug changed from ${before.slug}`,
      });
    }

    await recordActivity({
      actor: guard.actor,
      action: before ? "UPDATE" : "CREATE",
      entity: "Page",
      entityId: id,
      description: `${before ? "Updated" : "Created"} page "${d.title}"`,
      metadata: { slug, status: d.status },
    });

    revalidatePath("/admin/pages");
    revalidatePath(`/${slug}`);
    if (before && before.slug !== slug) revalidatePath(`/${before.slug}`);
    return { ok: true, id: id! };
  } catch (err) {
    return { ok: false, error: toSafeError(err, "action.savePage", { id }).message };
  }
}

export async function deletePage(id: string): Promise<ActionResult> {
  const guard = await guardAction("pages:delete");
  if (!guard.ok) return { ok: false, error: guard.error };
  try {
    const page = await prisma.page.delete({ where: { id } });

    await recordActivity({
      actor: guard.actor,
      action: "DELETE",
      entity: "Page",
      entityId: id,
      description: `Deleted page "${page.title}"`,
      metadata: { slug: page.slug },
    });

    revalidatePath("/admin/pages");
    revalidatePath(`/${page.slug}`);
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: toSafeError(err, "action.deletePage", { id }).message };
  }
}
