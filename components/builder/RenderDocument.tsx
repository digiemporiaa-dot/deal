import { prisma } from "@/lib/db";
import { nodeCss } from "@/lib/builder/styles";
import { parseDocument } from "@/lib/builder/schema";
import { flattenNodes } from "@/lib/builder/tree";
import { bool, itemStr, list, str } from "@/lib/builder/content";
import { faqSchema } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";
import { logger } from "@/lib/logger";
import { RenderNode, type RenderContext } from "@/components/builder/RenderNode";
import type { BuilderNode, PageDocument } from "@/lib/builder/schema";

/**
 * Renders a whole builder document.
 *
 * Three things happen here that cannot happen per node:
 *
 *  • Reusable sections are resolved, so a shared section's own styles and FAQ
 *    questions are part of the page like any other content.
 *  • Every node's styles are collected into one <style> block with real media
 *    queries — no inline styles, no runtime CSS-in-JS, nothing to hydrate.
 *  • FAQ elements contribute structured data, but only where the questions are
 *    actually rendered, which is what the search guidelines require.
 */

/** Replace `reusableId` placeholders with the shared section's real content. */
async function resolveReusableSections(document: PageDocument): Promise<PageDocument> {
  const ids = new Set<string>();
  for (const node of flattenNodes(document)) {
    if (node.reusableId) ids.add(node.reusableId);
  }
  if (ids.size === 0) return document;

  let shared: { id: string; content: unknown }[] = [];
  try {
    shared = await prisma.reusableSection.findMany({
      where: { id: { in: [...ids] }, status: "PUBLISHED" },
      select: { id: true, content: true },
    });
  } catch (error) {
    // A missing shared section should leave a gap, not break the page.
    logger.error("builder.reusable_load_failed", { error });
    return document;
  }

  const byId = new Map(
    shared.map((row) => [row.id, parseDocument(row.content).sections] as const),
  );

  function expand(nodes: BuilderNode[]): BuilderNode[] {
    return nodes.flatMap((node) => {
      if (node.reusableId) {
        const sections = byId.get(node.reusableId);
        // An unpublished or deleted shared section renders as nothing.
        if (!sections) return [];
        // Ids are namespaced so two uses of the same shared section on one
        // page cannot collide in the stylesheet or in React keys.
        return sections.map((section) => namespaceIds(section, node.id));
      }
      return node.children?.length ? [{ ...node, children: expand(node.children) }] : [node];
    });
  }

  return { ...document, sections: expand(document.sections) };
}

function namespaceIds(node: BuilderNode, prefix: string): BuilderNode {
  return {
    ...node,
    id: `${prefix}-${node.id}`,
    children: node.children?.map((child) => namespaceIds(child, prefix)),
  };
}

/** One stylesheet for the whole page. */
function documentCss(document: PageDocument): string {
  const rules = flattenNodes(document)
    .map((node) => nodeCss(node.id, node.settings))
    .filter(Boolean);

  // Structural defaults the generated rules build on. Kept here rather than in
  // globals.css so a page with no builder content ships none of it.
  const base = [
    ".vd-section{width:100%}",
    ".vd-container{width:100%;margin-left:auto;margin-right:auto}",
    ".vd-grid{grid-template-columns:repeat(var(--vd-cols,3),minmax(0,1fr))}",
    ".vd-hero-overlay{background:var(--vd-overlay,transparent)}",
  ].join("");

  return base + rules.join("");
}

/**
 * FAQ structured data, gathered from every FAQ element that opted in.
 *
 * Only questions that are rendered on this page are described, so the markup
 * always matches what a visitor can see.
 */
function collectFaqs(document: PageDocument): { question: string; answer: string }[] {
  const faqs: { question: string; answer: string }[] = [];

  for (const node of flattenNodes(document)) {
    if (node.type !== "faq") continue;
    if (!bool(node.content, "schema", true)) continue;

    for (const item of list(node.content, "items")) {
      const question = itemStr(item, "question").trim();
      const answer = itemStr(item, "answer").trim();
      if (question && answer) faqs.push({ question, answer });
    }
  }

  return faqs;
}

/**
 * The grid helper reads its column count from a custom property, so the
 * per-breakpoint `columns` setting can drive card grids inside an element the
 * admin never nests by hand.
 */
function gridVariables(document: PageDocument): string {
  return flattenNodes(document)
    .map((node) => {
      const desktop = node.settings?.desktop?.columns;
      const tablet = node.settings?.tablet?.columns;
      const mobile = node.settings?.mobile?.columns;
      if (!desktop && !tablet && !mobile) return "";

      const selector = `[data-b="${node.id}"] .vd-grid,[data-b="${node.id}"].vd-grid`;
      const parts: string[] = [];
      if (desktop) parts.push(`${selector}{--vd-cols:${desktop}}`);
      if (tablet) parts.push(`@media (max-width:1024px){${selector}{--vd-cols:${tablet}}}`);
      if (mobile) parts.push(`@media (max-width:640px){${selector}{--vd-cols:${mobile}}}`);
      return parts.join("");
    })
    .filter(Boolean)
    .join("");
}

/** Hero overlays are a custom property so the overlay sits above the image. */
function overlayVariables(document: PageDocument): string {
  return flattenNodes(document)
    .map((node) => {
      const overlay = node.settings?.desktop?.overlay;
      if (!overlay) return "";
      const safe = overlay.replace(/[{};<>]/g, "");
      return `[data-b="${node.id}"]{--vd-overlay:${safe}}`;
    })
    .filter(Boolean)
    .join("");
}

export async function RenderDocument({
  content,
  ctx = {},
}: {
  content: unknown;
  ctx?: RenderContext;
}) {
  const parsed = parseDocument(content);
  if (parsed.sections.length === 0) return null;

  const document = await resolveReusableSections(parsed);
  const css = documentCss(document) + gridVariables(document) + overlayVariables(document);
  const faqs = collectFaqs(document);
  const schema = faqs.length > 0 ? faqSchema(faqs) : null;

  return (
    <>
      {/* The id lets the editor preview replace this block wholesale. */}
      <style id="vd-builder-css" dangerouslySetInnerHTML={{ __html: css }} />
      {schema && <JsonLd data={schema} />}
      {document.sections.map((section) => (
        <RenderNode key={section.id} node={section} ctx={ctx} />
      ))}
    </>
  );
}

/** True when a page has builder content worth rendering. */
export function hasBuilderContent(content: unknown): boolean {
  return parseDocument(content).sections.length > 0;
}

export { str };
