import { sanitizeHtml } from "@/lib/sanitize";
import { validateDocument, type BuilderNode, type PageDocument } from "@/lib/builder/schema";
import { getElementDef, isKnownType, type FieldDef } from "@/lib/builder/registry";

/**
 * The server-side boundary for anything the builder saves.
 *
 * The editor validates as a convenience; this is the actual gate. Everything
 * arriving here is untrusted — a crafted request can call the same Server
 * Action the UI does — so the document is re-validated, unknown element types
 * are rejected, restricted elements need the right role, and every HTML field
 * is sanitised again regardless of what the client claims it sent.
 */

export type PrepareResult =
  | { ok: true; document: PageDocument }
  | { ok: false; error: string };

/**
 * Content keys that hold HTML, derived from the registry rather than hardcoded.
 *
 * Deriving them means a new element with a rich-text field is sanitised the
 * day it is added, instead of quietly bypassing this until someone remembers
 * to extend a list.
 */
function htmlKeys(fields: FieldDef[]): { direct: string[]; repeaters: Record<string, string[]> } {
  const direct: string[] = [];
  const repeaters: Record<string, string[]> = {};

  for (const field of fields) {
    // `html` by name is always treated as HTML, even on a plain textarea —
    // that is how the restricted Custom HTML element stores its markup.
    if (field.type === "richtext" || field.key === "html") direct.push(field.key);
    if (field.type === "repeater") {
      const nested = field.fields
        .filter((sub) => sub.type === "richtext" || sub.key === "html")
        .map((sub) => sub.key);
      if (nested.length) repeaters[field.key] = nested;
    }
  }

  return { direct, repeaters };
}

function cleanContent(type: string, content: Record<string, unknown>): Record<string, unknown> {
  const def = getElementDef(type);
  const next = { ...content };
  const keys = def ? htmlKeys(def.fields) : { direct: ["html"], repeaters: {} };

  for (const key of keys.direct) {
    if (typeof next[key] === "string") next[key] = sanitizeHtml(next[key] as string);
  }

  for (const [listKey, subKeys] of Object.entries(keys.repeaters)) {
    const items = next[listKey];
    if (!Array.isArray(items)) continue;
    next[listKey] = items.map((item) => {
      if (!item || typeof item !== "object") return item;
      const entry = { ...(item as Record<string, unknown>) };
      for (const subKey of subKeys) {
        if (typeof entry[subKey] === "string") entry[subKey] = sanitizeHtml(entry[subKey] as string);
      }
      return entry;
    });
  }

  return next;
}

/**
 * Validate a document and normalise everything inside it that could be
 * dangerous or malformed.
 *
 * `allowRestricted` is the caller's answer to "may this user save raw HTML?"
 * — it is decided from the session role, never from the document.
 */
export function prepareDocument(
  input: unknown,
  options: { allowRestricted: boolean },
): PrepareResult {
  const validated = validateDocument(input);
  if (!validated.ok) return validated;

  const unknownTypes = new Set<string>();
  const restrictedTypes = new Set<string>();

  function clean(nodes: BuilderNode[]): BuilderNode[] {
    return nodes.map((node) => {
      if (!isKnownType(node.type)) unknownTypes.add(node.type);

      const def = getElementDef(node.type);
      if (def?.restricted && !options.allowRestricted) restrictedTypes.add(node.type);

      return {
        ...node,
        content: cleanContent(node.type, node.content ?? {}),
        children: node.children ? clean(node.children) : undefined,
      };
    });
  }

  const sections = clean(validated.document.sections);

  if (unknownTypes.size > 0) {
    return { ok: false, error: `Unknown element type: ${[...unknownTypes].join(", ")}` };
  }
  if (restrictedTypes.size > 0) {
    return { ok: false, error: "Custom HTML can only be saved by an administrator." };
  }

  return { ok: true, document: { ...validated.document, sections } };
}
