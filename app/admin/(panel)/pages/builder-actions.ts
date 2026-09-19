"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { guardAction } from "@/lib/guard";
import { publishBlocked, hasPermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity";
import { toSafeError } from "@/lib/errors";
import { createSlugRedirect } from "@/lib/redirects";
import { slugify } from "@/lib/utils";
import { isReservedSlug, pathForSlug } from "@/lib/builder/routes";
import { validateDocument, type PageDocument } from "@/lib/builder/schema";
import { prepareDocument } from "@/lib/builder/prepare";
import { regenerateIds } from "@/lib/builder/tree";
import type { Prisma } from "@prisma/client";

/**
 * Server actions for the page builder.
 *
 * Everything the builder sends is untrusted: the document is re-validated
 * here, unknown element types are rejected, and any HTML inside it is
 * sanitised again server-side. The editor's own validation is a convenience,
 * never the boundary.
 */

/** How many revisions to keep per page before the oldest are pruned. */
const REVISION_LIMIT = 30;

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/** Confirm the user may edit this page, and hand back the page row. */
async function loadEditablePage(pageId: string) {
  const guard = await guardAction("pages:update");
  if (!guard.ok) return { ok: false as const, error: guard.error };

  const page = await prisma.page.findUnique({
    where: { id: pageId },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      draftContent: true,
      publishedContent: true,
    },
  });
  if (!page) return { ok: false as const, error: "Page not found." };

  return { ok: true as const, actor: guard.actor, page };
}

/* ─────────────────────────── saving ─────────────────────────── */

export async function saveDraft(pageId: string, content: unknown): Promise<Result> {
  const loaded = await loadEditablePage(pageId);
  if (!loaded.ok) return loaded;

  const prepared = prepareDocument(content, {
    allowRestricted: hasPermission(loaded.actor.role, "settings:manage"),
  });
  if (!prepared.ok) return prepared;

  try {
    await prisma.page.update({
      where: { id: pageId },
      data: {
        draftContent: prepared.document as unknown as Prisma.InputJsonValue,
        updatedById: loaded.actor.id,
      },
    });
    // The editor reloads the draft from here, so its own route is refreshed.
    revalidatePath(`/admin/pages/${pageId}/builder`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: toSafeError(err, "action.saveDraft", { pageId }).message };
  }
}

/**
 * Publish the draft.
 *
 * Copies the draft into the published column and records a revision, so the
 * version a visitor sees only ever changes at this moment.
 */
export async function publishPage(pageId: string, content?: unknown): Promise<Result> {
  const loaded = await loadEditablePage(pageId);
  if (!loaded.ok) return loaded;

  // Publishing is its own permission: an EDITOR can change a page but not
  // put the change live.
  const blocked = publishBlocked(loaded.actor.role, "pages:create", true);
  if (blocked) return { ok: false, error: blocked };

  const source = content ?? loaded.page.draftContent;
  const prepared = prepareDocument(source, {
    allowRestricted: hasPermission(loaded.actor.role, "settings:manage"),
  });
  if (!prepared.ok) return prepared;

  if (prepared.document.sections.length === 0) {
    return { ok: false, error: "Add at least one section before publishing." };
  }

  try {
    const document = prepared.document as unknown as Prisma.InputJsonValue;

    await prisma.$transaction(async (tx) => {
      await tx.page.update({
        where: { id: pageId },
        data: {
          draftContent: document,
          publishedContent: document,
          status: "PUBLISHED",
          publishedAt: new Date(),
          updatedById: loaded.actor.id,
        },
      });

      const last = await tx.pageRevision.findFirst({
        where: { pageId },
        orderBy: { version: "desc" },
        select: { version: true },
      });

      await tx.pageRevision.create({
        data: {
          pageId,
          version: (last?.version ?? 0) + 1,
          content: document,
          reason: "publish",
          createdById: loaded.actor.id,
        },
      });
    });

    await pruneRevisions(pageId);

    await recordActivity({
      actor: loaded.actor,
      action: "STATUS_CHANGE",
      entity: "Page",
      entityId: pageId,
      description: `Published page "${loaded.page.title}"`,
      metadata: { slug: loaded.page.slug, sections: prepared.document.sections.length },
    });

    revalidatePublic(loaded.page.slug);

    return { ok: true };
  } catch (err) {
    return { ok: false, error: toSafeError(err, "action.publishPage", { pageId }).message };
  }
}

export async function unpublishPage(pageId: string): Promise<Result> {
  const loaded = await loadEditablePage(pageId);
  if (!loaded.ok) return loaded;

  const blocked = publishBlocked(loaded.actor.role, "pages:create", true);
  if (blocked) return { ok: false, error: blocked };

  try {
    await prisma.page.update({
      where: { id: pageId },
      data: { status: "DRAFT", updatedById: loaded.actor.id },
    });

    await recordActivity({
      actor: loaded.actor,
      action: "STATUS_CHANGE",
      entity: "Page",
      entityId: pageId,
      description: `Unpublished page "${loaded.page.title}"`,
    });

    revalidatePublic(loaded.page.slug);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: toSafeError(err, "action.unpublishPage", { pageId }).message };
  }
}

/** Keep the history bounded so a busy page does not grow without limit. */
async function pruneRevisions(pageId: string): Promise<void> {
  try {
    const keep = await prisma.pageRevision.findMany({
      where: { pageId },
      orderBy: { version: "desc" },
      take: REVISION_LIMIT,
      select: { id: true },
    });
    if (keep.length < REVISION_LIMIT) return;
    await prisma.pageRevision.deleteMany({
      where: { pageId, id: { notIn: keep.map((row) => row.id) } },
    });
  } catch {
    // Pruning is housekeeping; failing it must not fail the publish.
  }
}

/** Snapshot the current draft without publishing it. */
export async function saveRevision(pageId: string, note?: string): Promise<Result> {
  const loaded = await loadEditablePage(pageId);
  if (!loaded.ok) return loaded;

  const prepared = prepareDocument(loaded.page.draftContent, { allowRestricted: true });
  if (!prepared.ok) return prepared;

  try {
    const last = await prisma.pageRevision.findFirst({
      where: { pageId },
      orderBy: { version: "desc" },
      select: { version: true },
    });

    await prisma.pageRevision.create({
      data: {
        pageId,
        version: (last?.version ?? 0) + 1,
        content: prepared.document as unknown as Prisma.InputJsonValue,
        reason: "manual",
        note: note?.slice(0, 200) || null,
        createdById: loaded.actor.id,
      },
    });

    await pruneRevisions(pageId);
    revalidatePath(`/admin/pages/${pageId}/builder`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: toSafeError(err, "action.saveRevision", { pageId }).message };
  }
}

/**
 * Put an earlier revision back into the draft.
 *
 * Restoring never touches the published page — the editor can look at the
 * restored version and decide whether to publish it.
 */
export async function restoreRevision(pageId: string, revisionId: string): Promise<Result> {
  const loaded = await loadEditablePage(pageId);
  if (!loaded.ok) return loaded;

  const revision = await prisma.pageRevision.findFirst({
    where: { id: revisionId, pageId },
    select: { content: true, version: true },
  });
  if (!revision) return { ok: false, error: "That revision no longer exists." };

  const prepared = prepareDocument(revision.content, { allowRestricted: true });
  if (!prepared.ok) return prepared;

  try {
    const document = prepared.document as unknown as Prisma.InputJsonValue;

    await prisma.$transaction(async (tx) => {
      // The current draft is snapshotted first, so restoring is itself
      // undoable rather than a one-way door.
      const last = await tx.pageRevision.findFirst({
        where: { pageId },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      await tx.pageRevision.create({
        data: {
          pageId,
          version: (last?.version ?? 0) + 1,
          content: (loaded.page.draftContent ?? { version: 1, sections: [] }) as Prisma.InputJsonValue,
          reason: "restore",
          note: `Replaced by revision ${revision.version}`,
          createdById: loaded.actor.id,
        },
      });

      await tx.page.update({
        where: { id: pageId },
        data: { draftContent: document, updatedById: loaded.actor.id },
      });
    });

    await recordActivity({
      actor: loaded.actor,
      action: "UPDATE",
      entity: "Page",
      entityId: pageId,
      description: `Restored revision ${revision.version} of "${loaded.page.title}"`,
      metadata: { revisionId },
    });

    revalidatePath(`/admin/pages/${pageId}/builder`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: toSafeError(err, "action.restoreRevision", { pageId }).message };
  }
}

/**
 * Refresh every cached surface a page change can affect.
 *
 * A page that backs a code route (the homepage, contact) renders at that path
 * rather than at /<slug>, so both are revalidated — missing this is how a
 * publish appears to do nothing.
 */
function revalidatePublic(slug: string): void {
  revalidatePath(`/${slug}`);
  const route = pathForSlug(slug);
  if (route !== `/${slug}`) revalidatePath(route);
  revalidatePath("/admin/pages");
  revalidatePath("/sitemap.xml");
}

/* ───────────────────────── page lifecycle ───────────────────── */

/** Zod refinement for a slug an admin typed, so the message names the problem. */
const freeSlug = (value: string) => !isReservedSlug(slugify(value));
const reservedMessage = "That address is used by the site itself — choose another.";

const createPageSchema = z.object({
  title: z.string().trim().min(2, "Give the page a title").max(200),
  slug: z.string().trim().max(200).refine(freeSlug, reservedMessage).optional(),
  template: z.string().trim().max(60).optional(),
});

async function uniqueSlug(base: string, ignoreId?: string): Promise<string> {
  const root = slugify(base) || "page";
  let candidate = root;
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // A reserved slug is treated as taken: a static route owns that URL, so a
    // page there would save happily and then never render.
    const clash = isReservedSlug(candidate)
      ? true
      : await prisma.page
          .findUnique({ where: { slug: candidate }, select: { id: true } })
          .then((existing) => Boolean(existing) && existing?.id !== ignoreId);
    if (!clash) return candidate;
    candidate = `${root}-${++n}`;
  }
}

export async function createBuilderPage(
  input: z.infer<typeof createPageSchema>,
): Promise<Result<{ id: string }>> {
  const guard = await guardAction("pages:create");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = createPageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || "Check the form." };
  }

  try {
    const slug = await uniqueSlug(parsed.data.slug || parsed.data.title);

    // A template supplies the starting layout; ids are regenerated so two
    // pages from one template never share node ids.
    let document: PageDocument = { version: 1, sections: [] };
    if (parsed.data.template) {
      const template = await prisma.pageTemplate.findUnique({
        where: { slug: parsed.data.template },
        select: { content: true },
      });
      const validated = template ? validateDocument(template.content) : null;
      if (validated?.ok) {
        document = {
          ...validated.document,
          sections: validated.document.sections.map(regenerateIds),
        };
      }
    }

    const page = await prisma.page.create({
      data: {
        title: parsed.data.title,
        slug,
        // The legacy column stays empty: this page renders from the builder.
        content: "",
        status: "DRAFT",
        template: parsed.data.template || null,
        draftContent: document as unknown as Prisma.InputJsonValue,
        createdById: guard.actor.id,
        updatedById: guard.actor.id,
      },
      select: { id: true, title: true },
    });

    await recordActivity({
      actor: guard.actor,
      action: "CREATE",
      entity: "Page",
      entityId: page.id,
      description: `Created page "${page.title}"`,
      metadata: { slug, template: parsed.data.template ?? null },
    });

    revalidatePath("/admin/pages");
    return { ok: true, id: page.id };
  } catch (err) {
    return { ok: false, error: toSafeError(err, "action.createBuilderPage").message };
  }
}

export async function duplicatePage(pageId: string): Promise<Result<{ id: string }>> {
  const guard = await guardAction("pages:create");
  if (!guard.ok) return { ok: false, error: guard.error };

  try {
    const source = await prisma.page.findUnique({ where: { id: pageId } });
    if (!source) return { ok: false, error: "Page not found." };

    const validated = validateDocument(source.draftContent ?? source.publishedContent);
    const document: PageDocument = validated.ok
      ? { ...validated.document, sections: validated.document.sections.map(regenerateIds) }
      : { version: 1, sections: [] };

    const slug = await uniqueSlug(`${source.slug}-copy`);

    const copy = await prisma.page.create({
      data: {
        title: `${source.title} (copy)`,
        slug,
        content: source.content,
        sections: source.sections,
        // A duplicate always starts unpublished, so it cannot quietly appear
        // on the site at a near-identical URL.
        status: "DRAFT",
        seoTitle: source.seoTitle,
        seoDescription: source.seoDescription,
        ogImage: source.ogImage,
        template: source.template,
        draftContent: document as unknown as Prisma.InputJsonValue,
        createdById: guard.actor.id,
        updatedById: guard.actor.id,
      },
      select: { id: true, title: true },
    });

    await recordActivity({
      actor: guard.actor,
      action: "CREATE",
      entity: "Page",
      entityId: copy.id,
      description: `Duplicated page "${source.title}"`,
      metadata: { from: pageId, slug },
    });

    revalidatePath("/admin/pages");
    return { ok: true, id: copy.id };
  } catch (err) {
    return { ok: false, error: toSafeError(err, "action.duplicatePage", { pageId }).message };
  }
}

const detailsSchema = z.object({
  title: z.string().trim().min(2, "Give the page a title").max(200),
  slug: z.string().trim().min(1, "Give the page an address").max(200).refine(freeSlug, reservedMessage),
  // Empty means "fall back to the page title / the site description", which
  // is why these are stored as null rather than as an empty string.
  seoTitle: z.string().trim().max(200).optional(),
  seoDescription: z.string().trim().max(400).optional(),
  ogImage: z.string().trim().max(1000).optional(),
});

/** Rename a page and set its SEO, keeping its old URL working. */
export async function updatePageDetails(
  pageId: string,
  input: z.infer<typeof detailsSchema>,
): Promise<Result<{ slug: string }>> {
  const loaded = await loadEditablePage(pageId);
  if (!loaded.ok) return loaded;

  const parsed = detailsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || "Check the details." };
  }

  try {
    const slug = await uniqueSlug(parsed.data.slug, pageId);

    await prisma.page.update({
      where: { id: pageId },
      data: {
        title: parsed.data.title,
        slug,
        seoTitle: parsed.data.seoTitle || null,
        seoDescription: parsed.data.seoDescription || null,
        ogImage: parsed.data.ogImage || null,
        updatedById: loaded.actor.id,
      },
    });

    // An indexed URL must keep working after a rename.
    if (slug !== loaded.page.slug) {
      await createSlugRedirect({
        oldPath: `/${loaded.page.slug}`,
        newPath: `/${slug}`,
        note: `Page slug changed from ${loaded.page.slug}`,
      });
    }

    await recordActivity({
      actor: loaded.actor,
      action: "UPDATE",
      entity: "Page",
      entityId: pageId,
      description: `Updated page details for "${parsed.data.title}"`,
      metadata: slug !== loaded.page.slug ? { slug: { from: loaded.page.slug, to: slug } } : undefined,
    });

    revalidatePublic(slug);
    // The old address now redirects, so its cache entry is stale too.
    if (slug !== loaded.page.slug) revalidatePublic(loaded.page.slug);
    return { ok: true, slug };
  } catch (err) {
    return { ok: false, error: toSafeError(err, "action.updatePageDetails", { pageId }).message };
  }
}

/* ──────────────────── reusable sections ─────────────────────── */

const reusableSchema = z.object({
  name: z.string().trim().min(2, "Give the section a name").max(120),
  description: z.string().trim().max(300).optional(),
});

export async function saveReusableSection(
  input: z.infer<typeof reusableSchema>,
  node: unknown,
): Promise<Result<{ id: string }>> {
  const guard = await guardAction("pages:update");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = reusableSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || "Check the form." };
  }

  // A reusable section is stored as a one-section document, so the same
  // validator and renderer handle it.
  const prepared = prepareDocument({ version: 1, sections: [node] }, {
    allowRestricted: hasPermission(guard.actor.role, "settings:manage"),
  });
  if (!prepared.ok) return prepared;

  try {
    let slug = slugify(parsed.data.name) || "section";
    const clash = await prisma.reusableSection.findUnique({ where: { slug }, select: { id: true } });
    if (clash) slug = `${slug}-${Date.now().toString(36)}`;

    const saved = await prisma.reusableSection.create({
      data: {
        name: parsed.data.name,
        slug,
        description: parsed.data.description || null,
        content: prepared.document as unknown as Prisma.InputJsonValue,
        status: "PUBLISHED",
        createdById: guard.actor.id,
      },
      select: { id: true, name: true },
    });

    await recordActivity({
      actor: guard.actor,
      action: "CREATE",
      entity: "Page",
      entityId: saved.id,
      description: `Saved reusable section "${saved.name}"`,
    });

    revalidatePath("/admin/pages/sections");
    return { ok: true, id: saved.id };
  } catch (err) {
    return { ok: false, error: toSafeError(err, "action.saveReusableSection").message };
  }
}

export async function updateReusableSection(id: string, node: unknown): Promise<Result> {
  const guard = await guardAction("pages:update");
  if (!guard.ok) return { ok: false, error: guard.error };

  const prepared = prepareDocument({ version: 1, sections: [node] }, {
    allowRestricted: hasPermission(guard.actor.role, "settings:manage"),
  });
  if (!prepared.ok) return prepared;

  try {
    const section = await prisma.reusableSection.update({
      where: { id },
      data: { content: prepared.document as unknown as Prisma.InputJsonValue },
      select: { name: true },
    });

    await recordActivity({
      actor: guard.actor,
      action: "UPDATE",
      entity: "Page",
      entityId: id,
      description: `Updated reusable section "${section.name}" — every page using it now shows the change`,
    });

    // Every published page could embed this, so the whole site is refreshed.
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: toSafeError(err, "action.updateReusableSection", { id }).message };
  }
}

export async function deleteReusableSection(id: string): Promise<Result> {
  const guard = await guardAction("pages:delete");
  if (!guard.ok) return { ok: false, error: guard.error };

  try {
    const section = await prisma.reusableSection.delete({ where: { id }, select: { name: true } });
    await recordActivity({
      actor: guard.actor,
      action: "DELETE",
      entity: "Page",
      entityId: id,
      description: `Deleted reusable section "${section.name}"`,
    });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: toSafeError(err, "action.deleteReusableSection", { id }).message };
  }
}

/* ───────────────────────── templates ────────────────────────── */

const templateSchema = z.object({
  name: z.string().trim().min(2, "Give the template a name").max(120),
  category: z.string().trim().max(60).optional(),
  kind: z.enum(["page", "section"]).default("section"),
});

export async function saveTemplate(
  input: z.infer<typeof templateSchema>,
  content: unknown,
): Promise<Result<{ id: string }>> {
  const guard = await guardAction("pages:update");
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || "Check the form." };
  }

  // A section template is wrapped into a document so both kinds share a shape.
  const document =
    parsed.data.kind === "page" ? content : { version: 1, sections: [content] };

  const prepared = prepareDocument(document, {
    allowRestricted: hasPermission(guard.actor.role, "settings:manage"),
  });
  if (!prepared.ok) return prepared;

  try {
    let slug = slugify(parsed.data.name) || "template";
    const clash = await prisma.pageTemplate.findUnique({ where: { slug }, select: { id: true } });
    if (clash) slug = `${slug}-${Date.now().toString(36)}`;

    const template = await prisma.pageTemplate.create({
      data: {
        name: parsed.data.name,
        slug,
        kind: parsed.data.kind,
        category: parsed.data.category || "General",
        content: prepared.document as unknown as Prisma.InputJsonValue,
        createdById: guard.actor.id,
      },
      select: { id: true, name: true },
    });

    await recordActivity({
      actor: guard.actor,
      action: "CREATE",
      entity: "Page",
      entityId: template.id,
      description: `Saved template "${template.name}"`,
      metadata: { kind: parsed.data.kind },
    });

    revalidatePath("/admin/pages");
    return { ok: true, id: template.id };
  } catch (err) {
    return { ok: false, error: toSafeError(err, "action.saveTemplate").message };
  }
}

export async function deleteTemplate(id: string): Promise<Result> {
  const guard = await guardAction("pages:delete");
  if (!guard.ok) return { ok: false, error: guard.error };

  try {
    const template = await prisma.pageTemplate.findUnique({
      where: { id },
      select: { name: true, isBuiltIn: true },
    });
    if (!template) return { ok: false, error: "Template not found." };
    if (template.isBuiltIn) {
      return { ok: false, error: "Built-in templates cannot be deleted." };
    }

    await prisma.pageTemplate.delete({ where: { id } });
    await recordActivity({
      actor: guard.actor,
      action: "DELETE",
      entity: "Page",
      entityId: id,
      description: `Deleted template "${template.name}"`,
    });
    revalidatePath("/admin/pages");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: toSafeError(err, "action.deleteTemplate", { id }).message };
  }
}

/** Templates and reusable sections offered by the builder's insert panel. */
export async function listInsertables(): Promise<{
  templates: { id: string; name: string; slug: string; kind: string; category: string; content: unknown }[];
  sections: { id: string; name: string; description: string | null }[];
}> {
  const guard = await guardAction("pages:view");
  if (!guard.ok) return { templates: [], sections: [] };

  const [templates, sections] = await Promise.all([
    prisma.pageTemplate.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true, kind: true, category: true, content: true },
      take: 200,
    }),
    prisma.reusableSection.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, description: true },
      take: 200,
    }),
  ]);

  return { templates, sections };
}
