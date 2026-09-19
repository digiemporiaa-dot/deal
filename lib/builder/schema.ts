import { z } from "zod";

/**
 * The page-builder document format.
 *
 * Types are inferred from the Zod schemas rather than declared separately, so
 * the validator and the TypeScript types can never drift apart. Everything
 * that reaches the database goes through `pageDocumentSchema` first.
 *
 * Shape:
 *   document → sections[] → containers[] → columns[] → elements[]
 *
 * Nesting rules are enforced by the registry (`allowedChildren`), not here —
 * this schema only guarantees the document is structurally sound.
 */

export const BREAKPOINTS = ["desktop", "tablet", "mobile"] as const;
export type Breakpoint = (typeof BREAKPOINTS)[number];

/** A CSS length the admin typed. Kept as a string so "auto", "50%" and "2rem" all work. */
const cssLength = z.string().trim().max(40);

/** A colour, gradient or CSS colour function. */
const cssColor = z.string().trim().max(200);

const spacingSchema = z
  .object({
    top: cssLength.optional(),
    right: cssLength.optional(),
    bottom: cssLength.optional(),
    left: cssLength.optional(),
  })
  .partial();

export type Spacing = z.infer<typeof spacingSchema>;

/**
 * Per-breakpoint style settings.
 *
 * Every field is optional: an unset value on tablet or mobile inherits from
 * the breakpoint above it, which is what makes the responsive controls feel
 * like overrides rather than three separate designs.
 */
export const styleSettingsSchema = z
  .object({
    // Typography
    fontSize: cssLength.optional(),
    fontWeight: z.string().trim().max(20).optional(),
    lineHeight: z.string().trim().max(20).optional(),
    letterSpacing: cssLength.optional(),
    textAlign: z.enum(["left", "center", "right", "justify"]).optional(),
    textTransform: z.enum(["none", "uppercase", "lowercase", "capitalize"]).optional(),
    color: cssColor.optional(),

    // Background
    background: cssColor.optional(),
    backgroundImage: z.string().trim().max(1000).optional(),
    backgroundSize: z.enum(["cover", "contain", "auto"]).optional(),
    backgroundPosition: z.string().trim().max(40).optional(),
    backgroundRepeat: z.enum(["no-repeat", "repeat"]).optional(),
    /** Translucent colour drawn over a background image to keep text readable. */
    overlay: cssColor.optional(),

    // Box model
    padding: spacingSchema.optional(),
    margin: spacingSchema.optional(),
    width: cssLength.optional(),
    maxWidth: cssLength.optional(),
    minHeight: cssLength.optional(),

    // Layout
    display: z.enum(["block", "flex", "grid", "none"]).optional(),
    flexDirection: z.enum(["row", "column", "row-reverse", "column-reverse"]).optional(),
    alignItems: z.enum(["flex-start", "center", "flex-end", "stretch", "baseline"]).optional(),
    justifyContent: z
      .enum(["flex-start", "center", "flex-end", "space-between", "space-around", "space-evenly"])
      .optional(),
    flexWrap: z.enum(["wrap", "nowrap"]).optional(),
    gap: cssLength.optional(),
    /** Grid column count — the responsive control most pages actually need. */
    columns: z.coerce.number().int().min(1).max(6).optional(),

    // Border and effects
    borderWidth: cssLength.optional(),
    borderStyle: z.enum(["none", "solid", "dashed", "dotted"]).optional(),
    borderColor: cssColor.optional(),
    borderRadius: cssLength.optional(),
    boxShadow: z.string().trim().max(200).optional(),
    opacity: z.coerce.number().min(0).max(1).optional(),
  })
  .partial();

export type StyleSettings = z.infer<typeof styleSettingsSchema>;

export const advancedSettingsSchema = z
  .object({
    /** Extra class names. Sanitised to a safe character set on save. */
    customClass: z
      .string()
      .trim()
      .max(200)
      .regex(/^[a-zA-Z0-9_\- ]*$/, "Use letters, numbers, spaces, dashes and underscores only")
      .optional(),
    /** Anchor id, so a button can link to #this-section. */
    customId: z
      .string()
      .trim()
      .max(60)
      .regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/, "Must start with a letter")
      .optional(),
  })
  .partial();

export const nodeSettingsSchema = z
  .object({
    desktop: styleSettingsSchema.optional(),
    tablet: styleSettingsSchema.optional(),
    mobile: styleSettingsSchema.optional(),
    advanced: advancedSettingsSchema.optional(),
    /** Per-breakpoint visibility. Hiding still renders nothing, not just CSS. */
    hidden: z
      .object({
        desktop: z.boolean().optional(),
        tablet: z.boolean().optional(),
        mobile: z.boolean().optional(),
      })
      .partial()
      .optional(),
  })
  .partial();

export type NodeSettings = z.infer<typeof nodeSettingsSchema>;

/**
 * Element content is per-type, so it is validated generically here and then
 * narrowed by each element's own content schema in the registry. Values are
 * restricted to JSON primitives and shallow arrays/objects — no functions,
 * no deep structures that could be used to smuggle something past the
 * renderer.
 */
const contentValue: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string().max(20_000),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(contentValue).max(100),
    z.record(contentValue),
  ]),
);

const contentSchema = z.record(contentValue);

export type NodeContent = Record<string, unknown>;

/** A stable, non-positional node id. Never an array index. */
export const nodeIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/, "Invalid node id");

export type BuilderNode = {
  id: string;
  type: string;
  content?: NodeContent;
  settings?: NodeSettings;
  children?: BuilderNode[];
  /** Set on a node that renders a shared ReusableSection by id. */
  reusableId?: string;
};

/** Guard against a malicious or corrupt document nesting itself forever. */
export const MAX_DEPTH = 12;
export const MAX_NODES = 2000;

export const builderNodeSchema: z.ZodType<BuilderNode> = z.lazy(() =>
  z.object({
    id: nodeIdSchema,
    type: z.string().trim().min(1).max(60),
    content: contentSchema.optional(),
    settings: nodeSettingsSchema.optional(),
    children: z.array(builderNodeSchema).max(200).optional(),
    reusableId: z.string().trim().max(64).optional(),
  }),
);

export const pageDocumentSchema = z.object({
  version: z.literal(1).default(1),
  sections: z.array(builderNodeSchema).max(200).default([]),
});

export type PageDocument = z.infer<typeof pageDocumentSchema>;

export const EMPTY_DOCUMENT: PageDocument = { version: 1, sections: [] };

/** Walk the tree, counting nodes and checking depth. */
function inspectTree(
  nodes: BuilderNode[],
  depth: number,
): { count: number; maxDepth: number; ids: string[] } {
  let count = 0;
  let maxDepth = depth;
  const ids: string[] = [];

  for (const node of nodes) {
    count += 1;
    ids.push(node.id);
    if (node.children?.length) {
      const child = inspectTree(node.children, depth + 1);
      count += child.count;
      maxDepth = Math.max(maxDepth, child.maxDepth);
      ids.push(...child.ids);
    }
  }

  return { count, maxDepth, ids };
}

export type DocumentValidation =
  | { ok: true; document: PageDocument }
  | { ok: false; error: string };

/**
 * Validate a document before it is stored or rendered.
 *
 * Beyond the shape, this enforces the three things that make a tree safe to
 * recurse over: bounded depth, bounded size, and unique ids (duplicate ids
 * would make selection, drag-and-drop and React keys all behave unpredictably).
 */
export function validateDocument(input: unknown): DocumentValidation {
  const parsed = pageDocumentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || "Invalid page content" };
  }

  const { count, maxDepth, ids } = inspectTree(parsed.data.sections, 1);

  if (count > MAX_NODES) {
    return { ok: false, error: `This page has too many elements (limit ${MAX_NODES}).` };
  }
  if (maxDepth > MAX_DEPTH) {
    return { ok: false, error: `Elements are nested too deeply (limit ${MAX_DEPTH}).` };
  }

  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      return { ok: false, error: `Duplicate element id "${id}".` };
    }
    seen.add(id);
  }

  return { ok: true, document: parsed.data };
}

/**
 * Read a document out of a database Json column.
 * Anything unparseable renders as an empty page rather than throwing — a bad
 * row should not take a public page down.
 */
export function parseDocument(value: unknown): PageDocument {
  if (!value) return EMPTY_DOCUMENT;
  const result = validateDocument(value);
  return result.ok ? result.document : EMPTY_DOCUMENT;
}
