import type { NodeContent, NodeSettings } from "@/lib/builder/schema";

/**
 * The element registry — the single source of truth for what the builder can
 * create, what settings each element exposes, and what may be nested inside
 * what.
 *
 * This module holds metadata only: no React, no server imports. Both the
 * editor (client) and the renderer (server) read from it, and the public
 * bundle stays free of editor code.
 *
 * Adding a new element means adding an entry here plus a renderer component.
 * The settings panel is generated from `fields`, so no editor code changes.
 */

export type ElementCategory = "layout" | "basic" | "content" | "travel" | "marketing";

export const CATEGORY_LABELS: Record<ElementCategory, string> = {
  layout: "Layout",
  basic: "Basic",
  content: "Content",
  travel: "Travel",
  marketing: "Marketing",
};

/** A declarative form field. The settings panel renders these generically. */
export type FieldDef =
  | { key: string; label: string; type: "text"; placeholder?: string; help?: string }
  | { key: string; label: string; type: "textarea"; rows?: number; placeholder?: string; help?: string }
  | { key: string; label: string; type: "richtext"; help?: string }
  | { key: string; label: string; type: "number"; min?: number; max?: number; help?: string }
  | { key: string; label: string; type: "url"; placeholder?: string; help?: string }
  | { key: string; label: string; type: "color"; help?: string }
  | { key: string; label: string; type: "image"; help?: string }
  | { key: string; label: string; type: "icon"; help?: string }
  | { key: string; label: string; type: "switch"; help?: string }
  | { key: string; label: string; type: "select"; options: { value: string; label: string }[]; help?: string }
  | {
      key: string;
      label: string;
      type: "repeater";
      itemLabel: string;
      fields: FieldDef[];
      max?: number;
      help?: string;
    }
  | {
      key: string;
      label: string;
      type: "collection";
      /** Which catalogue the manual picker and dynamic source read from. */
      resource: "package" | "destination" | "blog";
      help?: string;
    };

export type ElementDef = {
  type: string;
  label: string;
  category: ElementCategory;
  /** lucide-react icon name; resolved in the editor only. */
  icon: string;
  description?: string;
  /** Node types that may be dropped inside. Empty means it is a leaf. */
  allowedChildren: string[];
  fields: FieldDef[];
  defaultContent: NodeContent;
  defaultSettings: NodeSettings;
  /** Content key editable directly on the canvas by clicking the text. */
  inlineTextField?: string;
  /** Hidden from the "add element" list — created only by its parent. */
  internal?: boolean;
  /** Needs a permission above pages:update. Used for raw HTML. */
  restricted?: boolean;
};

/* ─────────────────────── shared field groups ─────────────────────── */

const linkFields: FieldDef[] = [
  { key: "href", label: "Link URL", type: "url", placeholder: "/packages or https://…" },
  { key: "newTab", label: "Open in a new tab", type: "switch" },
  { key: "nofollow", label: "Add nofollow", type: "switch", help: "Tells search engines not to pass ranking to this link." },
];

const imageFields: FieldDef[] = [
  { key: "src", label: "Image", type: "image" },
  { key: "alt", label: "Alt text", type: "text", help: "Describes the image for search engines and screen readers. Required for accessibility." },
  { key: "title", label: "Title", type: "text" },
  { key: "caption", label: "Caption", type: "text" },
];

/** Card-style repeaters share this item shape. */
const cardItemFields: FieldDef[] = [
  { key: "icon", label: "Icon", type: "icon" },
  { key: "image", label: "Image", type: "image" },
  { key: "title", label: "Title", type: "text" },
  { key: "text", label: "Text", type: "textarea", rows: 3 },
  { key: "href", label: "Link", type: "url" },
];

const headingTagOptions = [
  { value: "h1", label: "H1" },
  { value: "h2", label: "H2" },
  { value: "h3", label: "H3" },
  { value: "h4", label: "H4" },
  { value: "h5", label: "H5" },
  { value: "h6", label: "H6" },
  { value: "p", label: "Paragraph" },
];

/** Dynamic vs manual, the choice every catalogue element offers. */
const sourceFields = (resource: "package" | "destination" | "blog"): FieldDef[] => [
  {
    key: "source",
    label: "Content source",
    type: "select",
    options: [
      { value: "featured", label: "Featured" },
      { value: "latest", label: "Latest" },
      { value: "popular", label: "Most popular" },
      { value: "manual", label: "Choose specific items" },
    ],
    help: "Dynamic sources stay up to date on their own as you add content.",
  },
  { key: "items", label: "Chosen items", type: "collection", resource },
  { key: "limit", label: "How many to show", type: "number", min: 1, max: 24 },
];

/* ─────────────────────────── the registry ─────────────────────────── */

/**
 * Wildcard used in `allowedChildren`: "any non-layout element".
 *
 * Listing the content types explicitly would mean this file depended on its
 * own evaluation order — the layout definitions are declared before the
 * elements they accept. `canNest` resolves the wildcard at call time instead.
 */
export const ANY_CONTENT = "*content";

/** Identity helper, kept so element definitions read consistently. */
function element(def: ElementDef): ElementDef {
  return def;
}

const definitions: ElementDef[] = [
  /* ── Layout ── */
  {
    type: "section",
    label: "Section",
    category: "layout",
    icon: "Rows3",
    description: "A full-width band of the page.",
    allowedChildren: ["container"],
    fields: [],
    defaultContent: {},
    defaultSettings: {
      desktop: {
        padding: { top: "64px", bottom: "64px", left: "16px", right: "16px" },
        background: "",
      },
      mobile: { padding: { top: "40px", bottom: "40px", left: "16px", right: "16px" } },
    },
  },
  {
    type: "container",
    label: "Container",
    category: "layout",
    icon: "Square",
    description: "Centres and constrains its contents.",
    allowedChildren: ["columns", ANY_CONTENT],
    fields: [],
    defaultContent: {},
    defaultSettings: {
      desktop: { maxWidth: "1200px", width: "100%", display: "flex", flexDirection: "column", gap: "24px" },
    },
  },
  {
    type: "columns",
    label: "Columns",
    category: "layout",
    icon: "Columns3",
    description: "A responsive row of columns.",
    allowedChildren: ["column"],
    fields: [
      {
        key: "preset",
        label: "Layout",
        type: "select",
        options: [
          { value: "1", label: "1 column" },
          { value: "2", label: "2 columns" },
          { value: "3", label: "3 columns" },
          { value: "4", label: "4 columns" },
        ],
        help: "Change the column count per device in the Style tab.",
      },
    ],
    defaultContent: { preset: "2" },
    defaultSettings: {
      desktop: { display: "grid", columns: 2, gap: "24px" },
      tablet: { columns: 2 },
      mobile: { columns: 1 },
    },
  },
  {
    type: "column",
    label: "Column",
    category: "layout",
    icon: "Square",
    allowedChildren: ["columns", ANY_CONTENT],
    internal: true,
    fields: [],
    defaultContent: {},
    defaultSettings: { desktop: { display: "flex", flexDirection: "column", gap: "16px" } },
  },
];

/* ── Basic ── */
definitions.push(
  element({
    type: "heading",
    label: "Heading",
    category: "basic",
    icon: "Heading",
    allowedChildren: [],
    inlineTextField: "text",
    fields: [
      { key: "text", label: "Heading text", type: "text" },
      { key: "tag", label: "HTML tag", type: "select", options: headingTagOptions, help: "Use one H1 per page, then H2 and H3 in order." },
    ],
    defaultContent: { text: "Your heading here", tag: "h2" },
    defaultSettings: { desktop: { fontSize: "32px", fontWeight: "700", color: "#0f172a" } },
  }),
  element({
    type: "text",
    label: "Text",
    category: "basic",
    icon: "Type",
    allowedChildren: [],
    inlineTextField: "text",
    fields: [{ key: "text", label: "Text", type: "textarea", rows: 4 }],
    defaultContent: { text: "Write something here." },
    defaultSettings: { desktop: { fontSize: "16px", lineHeight: "1.7", color: "#475569" } },
  }),
  element({
    type: "richText",
    label: "Rich text",
    category: "basic",
    icon: "FileText",
    allowedChildren: [],
    fields: [{ key: "html", label: "Content", type: "richtext", help: "Formatting is kept; scripts and event handlers are always removed." }],
    defaultContent: { html: "<p>Rich text content.</p>" },
    defaultSettings: { desktop: { color: "#475569" } },
  }),
  element({
    type: "image",
    label: "Image",
    category: "basic",
    icon: "Image",
    allowedChildren: [],
    fields: [
      ...imageFields,
      {
        key: "objectFit",
        label: "Fit",
        type: "select",
        options: [
          { value: "cover", label: "Cover" },
          { value: "contain", label: "Contain" },
        ],
      },
      { key: "ratio", label: "Aspect ratio", type: "select", options: [
        { value: "auto", label: "Original" },
        { value: "16/9", label: "16:9" },
        { value: "4/3", label: "4:3" },
        { value: "1/1", label: "Square" },
        { value: "3/4", label: "Portrait" },
      ] },
      ...linkFields,
    ],
    defaultContent: { src: "", alt: "", objectFit: "cover", ratio: "16/9" },
    defaultSettings: { desktop: { borderRadius: "16px", width: "100%" } },
  }),
  element({
    type: "video",
    label: "Video",
    category: "basic",
    icon: "Video",
    allowedChildren: [],
    fields: [
      { key: "url", label: "YouTube or Vimeo URL", type: "url", placeholder: "https://www.youtube.com/watch?v=…" },
      { key: "title", label: "Accessible title", type: "text", help: "Described to screen readers in place of the video." },
    ],
    defaultContent: { url: "", title: "Video" },
    defaultSettings: { desktop: { borderRadius: "16px" } },
  }),
  element({
    type: "button",
    label: "Button",
    category: "basic",
    icon: "MousePointerClick",
    allowedChildren: [],
    inlineTextField: "label",
    fields: [
      { key: "label", label: "Button text", type: "text" },
      ...linkFields,
      {
        key: "variant",
        label: "Style",
        type: "select",
        options: [
          { value: "primary", label: "Primary" },
          { value: "secondary", label: "Secondary" },
          { value: "outline", label: "Outline" },
          { value: "ghost", label: "Text only" },
        ],
      },
      { key: "size", label: "Size", type: "select", options: [
        { value: "sm", label: "Small" },
        { value: "md", label: "Medium" },
        { value: "lg", label: "Large" },
      ] },
      { key: "icon", label: "Icon", type: "icon" },
      { key: "iconPosition", label: "Icon position", type: "select", options: [
        { value: "left", label: "Before text" },
        { value: "right", label: "After text" },
      ] },
    ],
    defaultContent: { label: "Learn more", href: "/packages", variant: "primary", size: "md", iconPosition: "left" },
    defaultSettings: {},
  }),
  element({
    type: "icon",
    label: "Icon",
    category: "basic",
    icon: "Star",
    allowedChildren: [],
    fields: [
      { key: "name", label: "Icon", type: "icon" },
      { key: "size", label: "Size (px)", type: "number", min: 12, max: 160 },
    ],
    defaultContent: { name: "Star", size: 32 },
    defaultSettings: { desktop: { color: "#0d9488" } },
  }),
  element({
    type: "divider",
    label: "Divider",
    category: "basic",
    icon: "Minus",
    allowedChildren: [],
    fields: [],
    defaultContent: {},
    defaultSettings: { desktop: { borderColor: "#e2e8f0", margin: { top: "24px", bottom: "24px" } } },
  }),
  element({
    type: "spacer",
    label: "Spacer",
    category: "basic",
    icon: "MoveVertical",
    allowedChildren: [],
    fields: [{ key: "height", label: "Height (px)", type: "number", min: 4, max: 400 }],
    defaultContent: { height: 48 },
    defaultSettings: {},
  }),
  element({
    type: "html",
    label: "Custom HTML",
    category: "basic",
    icon: "Code",
    description: "Advanced. Sanitised on save and on render.",
    restricted: true,
    allowedChildren: [],
    fields: [{ key: "html", label: "HTML", type: "textarea", rows: 10, help: "Scripts, iframes, forms and event handlers are removed. Embeds are not supported here." }],
    defaultContent: { html: "" },
    defaultSettings: {},
  }),
);

/* ── Content ── */
definitions.push(
  element({
    type: "imageText",
    label: "Image + Text",
    category: "content",
    icon: "PanelLeft",
    allowedChildren: [],
    fields: [
      { key: "image", label: "Image", type: "image" },
      { key: "alt", label: "Alt text", type: "text" },
      { key: "eyebrow", label: "Eyebrow", type: "text" },
      { key: "title", label: "Title", type: "text" },
      { key: "text", label: "Text", type: "textarea", rows: 4 },
      { key: "buttonLabel", label: "Button text", type: "text" },
      { key: "buttonHref", label: "Button link", type: "url" },
      { key: "imagePosition", label: "Image position", type: "select", options: [
        { value: "left", label: "Left" },
        { value: "right", label: "Right" },
      ] },
    ],
    defaultContent: { title: "A headline", text: "Supporting copy.", imagePosition: "left" },
    defaultSettings: {},
  }),
  element({
    type: "cards",
    label: "Cards",
    category: "content",
    icon: "LayoutGrid",
    allowedChildren: [],
    fields: [
      { key: "title", label: "Section title", type: "text" },
      { key: "subtitle", label: "Subtitle", type: "textarea", rows: 2 },
      {
        key: "style",
        label: "Card style",
        type: "select",
        options: [
          { value: "icon", label: "Icon cards" },
          { value: "image", label: "Image cards" },
          { value: "plain", label: "Text only" },
        ],
      },
      { key: "items", label: "Cards", type: "repeater", itemLabel: "Card", fields: cardItemFields, max: 24 },
    ],
    defaultContent: {
      style: "icon",
      items: [
        { icon: "ShieldCheck", title: "Secure booking", text: "Encrypted payments and verified partners." },
        { icon: "Headphones", title: "24×7 support", text: "Real people, before during and after travel." },
        { icon: "BadgeCheck", title: "Best price promise", text: "Premium experiences at fair prices." },
      ],
    },
    defaultSettings: { desktop: { columns: 3, gap: "24px" }, tablet: { columns: 2 }, mobile: { columns: 1 } },
  }),
  element({
    type: "featureList",
    label: "Feature list",
    category: "content",
    icon: "ListChecks",
    allowedChildren: [],
    fields: [
      { key: "items", label: "Items", type: "repeater", itemLabel: "Item", max: 30, fields: [
        { key: "icon", label: "Icon", type: "icon" },
        { key: "text", label: "Text", type: "text" },
      ] },
    ],
    defaultContent: { items: [{ icon: "Check", text: "Something included" }] },
    defaultSettings: {},
  }),
  element({
    type: "statistics",
    label: "Statistics",
    category: "content",
    icon: "TrendingUp",
    allowedChildren: [],
    fields: [
      { key: "items", label: "Numbers", type: "repeater", itemLabel: "Statistic", max: 8, fields: [
        { key: "value", label: "Value", type: "text" },
        { key: "label", label: "Label", type: "text" },
      ] },
      { key: "animate", label: "Count up when scrolled into view", type: "switch" },
    ],
    defaultContent: {
      animate: true,
      items: [
        { value: "10000", label: "Happy travellers" },
        { value: "120", label: "Destinations" },
        { value: "4.8", label: "Average rating" },
      ],
    },
    defaultSettings: { desktop: { columns: 3 }, mobile: { columns: 1 } },
  }),
  element({
    type: "gallery",
    label: "Gallery",
    category: "content",
    icon: "Images",
    allowedChildren: [],
    fields: [
      { key: "items", label: "Images", type: "repeater", itemLabel: "Image", max: 40, fields: imageFields },
    ],
    defaultContent: { items: [] },
    defaultSettings: { desktop: { columns: 3, gap: "12px" }, mobile: { columns: 2 } },
  }),
  element({
    type: "logoGrid",
    label: "Logo grid",
    category: "content",
    icon: "Grid2x2",
    allowedChildren: [],
    fields: [
      { key: "items", label: "Logos", type: "repeater", itemLabel: "Logo", max: 24, fields: [
        { key: "image", label: "Logo", type: "image" },
        { key: "alt", label: "Alt text", type: "text" },
        { key: "href", label: "Link", type: "url" },
      ] },
    ],
    defaultContent: { items: [] },
    defaultSettings: { desktop: { columns: 5 }, mobile: { columns: 3 } },
  }),
  element({
    type: "pricingTable",
    label: "Pricing table",
    category: "content",
    icon: "Table",
    allowedChildren: [],
    fields: [
      { key: "plans", label: "Plans", type: "repeater", itemLabel: "Plan", max: 6, fields: [
        { key: "name", label: "Name", type: "text" },
        { key: "price", label: "Price", type: "text" },
        { key: "period", label: "Period", type: "text" },
        { key: "features", label: "Features (one per line)", type: "textarea", rows: 5 },
        { key: "buttonLabel", label: "Button text", type: "text" },
        { key: "buttonHref", label: "Button link", type: "url" },
        { key: "featured", label: "Highlight this plan", type: "switch" },
      ] },
    ],
    defaultContent: { plans: [] },
    defaultSettings: { desktop: { columns: 3 }, mobile: { columns: 1 } },
  }),
  element({
    type: "comparisonTable",
    label: "Comparison table",
    category: "content",
    icon: "Table2",
    allowedChildren: [],
    fields: [
      { key: "headers", label: "Column headings (one per line)", type: "textarea", rows: 3 },
      { key: "rows", label: "Rows", type: "repeater", itemLabel: "Row", max: 40, fields: [
        { key: "cells", label: "Cells (one per line)", type: "textarea", rows: 3 },
      ] },
    ],
    defaultContent: { headers: "Feature\nBasic\nPremium", rows: [] },
    defaultSettings: {},
  }),
  element({
    type: "timeline",
    label: "Timeline",
    category: "content",
    icon: "GitCommitVertical",
    allowedChildren: [],
    fields: [
      { key: "items", label: "Steps", type: "repeater", itemLabel: "Step", max: 40, fields: [
        { key: "label", label: "Label", type: "text" },
        { key: "title", label: "Title", type: "text" },
        { key: "text", label: "Description", type: "textarea", rows: 3 },
      ] },
    ],
    defaultContent: { items: [] },
    defaultSettings: {},
  }),
  element({
    type: "tabs",
    label: "Tabs",
    category: "content",
    icon: "PanelTop",
    allowedChildren: [],
    fields: [
      { key: "items", label: "Tabs", type: "repeater", itemLabel: "Tab", max: 12, fields: [
        { key: "title", label: "Tab label", type: "text" },
        { key: "html", label: "Content", type: "richtext" },
      ] },
    ],
    defaultContent: { items: [{ title: "Tab one", html: "<p>Content</p>" }] },
    defaultSettings: {},
  }),
  element({
    type: "accordion",
    label: "Accordion",
    category: "content",
    icon: "ChevronsUpDown",
    allowedChildren: [],
    fields: [
      { key: "items", label: "Items", type: "repeater", itemLabel: "Item", max: 40, fields: [
        { key: "title", label: "Title", type: "text" },
        { key: "html", label: "Content", type: "richtext" },
      ] },
    ],
    defaultContent: { items: [] },
    defaultSettings: {},
  }),
  element({
    type: "faq",
    label: "FAQ",
    category: "content",
    icon: "CircleHelp",
    description: "Also emits FAQ structured data.",
    allowedChildren: [],
    fields: [
      { key: "title", label: "Section title", type: "text" },
      { key: "items", label: "Questions", type: "repeater", itemLabel: "Question", max: 50, fields: [
        { key: "question", label: "Question", type: "text" },
        { key: "answer", label: "Answer", type: "textarea", rows: 4 },
      ] },
      { key: "schema", label: "Add FAQ structured data", type: "switch", help: "Only enable when these questions are visible on the page." },
    ],
    defaultContent: { title: "Frequently asked questions", schema: true, items: [] },
    defaultSettings: {},
  }),
  element({
    type: "testimonials",
    label: "Testimonials",
    category: "content",
    icon: "Quote",
    allowedChildren: [],
    fields: [
      { key: "title", label: "Section title", type: "text" },
      {
        key: "source",
        label: "Source",
        type: "select",
        options: [
          { value: "published", label: "Published reviews from the database" },
          { value: "manual", label: "Written here" },
        ],
      },
      { key: "limit", label: "How many to show", type: "number", min: 1, max: 24 },
      { key: "items", label: "Testimonials", type: "repeater", itemLabel: "Testimonial", max: 24, fields: [
        { key: "name", label: "Name", type: "text" },
        { key: "text", label: "Review", type: "textarea", rows: 3 },
        { key: "rating", label: "Rating (1–5)", type: "number", min: 1, max: 5 },
        { key: "image", label: "Photo", type: "image" },
      ] },
    ],
    defaultContent: { source: "published", limit: 6, items: [] },
    defaultSettings: {},
  }),
);

/* ── Travel ── */
definitions.push(
  element({
    type: "packageGrid",
    label: "Package grid",
    category: "travel",
    icon: "Package",
    description: "Pulls live packages from the catalogue.",
    allowedChildren: [],
    fields: [
      { key: "title", label: "Section title", type: "text" },
      { key: "subtitle", label: "Subtitle", type: "textarea", rows: 2 },
      { key: "eyebrow", label: "Eyebrow", type: "text" },
      ...sourceFields("package"),
      { key: "destinationSlug", label: "Limit to destination", type: "text", help: "Destination slug. Leave empty for all." },
      { key: "linkHref", label: "'View all' link", type: "url" },
      { key: "linkLabel", label: "'View all' text", type: "text" },
    ],
    defaultContent: { source: "featured", limit: 6, linkHref: "/packages", linkLabel: "Browse all packages" },
    defaultSettings: { desktop: { columns: 3 }, tablet: { columns: 2 }, mobile: { columns: 1 } },
  }),
  element({
    type: "destinationGrid",
    label: "Destination grid",
    category: "travel",
    icon: "MapPin",
    description: "Pulls live destinations from the catalogue.",
    allowedChildren: [],
    fields: [
      { key: "title", label: "Section title", type: "text" },
      { key: "subtitle", label: "Subtitle", type: "textarea", rows: 2 },
      { key: "eyebrow", label: "Eyebrow", type: "text" },
      ...sourceFields("destination"),
      { key: "linkHref", label: "'View all' link", type: "url" },
      { key: "linkLabel", label: "'View all' text", type: "text" },
    ],
    defaultContent: { source: "featured", limit: 6, linkHref: "/destinations", linkLabel: "View all destinations" },
    defaultSettings: { desktop: { columns: 6 }, tablet: { columns: 3 }, mobile: { columns: 2 } },
  }),
  element({
    type: "blogGrid",
    label: "Travel blog grid",
    category: "travel",
    icon: "Newspaper",
    allowedChildren: [],
    fields: [
      { key: "title", label: "Section title", type: "text" },
      { key: "subtitle", label: "Subtitle", type: "textarea", rows: 2 },
      { key: "eyebrow", label: "Eyebrow", type: "text" },
      ...sourceFields("blog"),
      { key: "linkHref", label: "'View all' link", type: "url" },
      { key: "linkLabel", label: "'View all' text", type: "text" },
    ],
    defaultContent: { source: "latest", limit: 3, linkHref: "/blog", linkLabel: "Read the blog" },
    defaultSettings: { desktop: { columns: 3 }, mobile: { columns: 1 } },
  }),
  element({
    type: "packageSearch",
    label: "Package search",
    category: "travel",
    icon: "Search",
    allowedChildren: [],
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "placeholder", label: "Search placeholder", type: "text" },
      { key: "buttonLabel", label: "Button text", type: "text" },
    ],
    defaultContent: { placeholder: "Where do you want to go?", buttonLabel: "Search" },
    defaultSettings: {},
  }),
  element({
    type: "categoryStrip",
    label: "Category strip",
    category: "travel",
    icon: "LayoutList",
    description: "Package categories as quick links.",
    allowedChildren: [],
    fields: [{ key: "limit", label: "How many to show", type: "number", min: 1, max: 12 }],
    defaultContent: { limit: 6 },
    defaultSettings: {},
  }),
  element({
    type: "enquiryForm",
    label: "Travel enquiry form",
    category: "travel",
    icon: "ClipboardList",
    description: "Creates a real lead in the CRM.",
    allowedChildren: [],
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "subtitle", label: "Subtitle", type: "textarea", rows: 2 },
      { key: "buttonLabel", label: "Button text", type: "text" },
      { key: "source", label: "Lead source label", type: "text", help: "Recorded on the lead so you can tell which form it came from." },
      { key: "successMessage", label: "Thank-you message", type: "textarea", rows: 2 },
    ],
    defaultContent: {
      title: "Plan my trip",
      buttonLabel: "Send enquiry",
      source: "page-form",
      successMessage: "Thank you! Our travel experts will call you shortly.",
    },
    defaultSettings: {},
  }),
  element({
    type: "bookingCta",
    label: "Booking CTA",
    category: "travel",
    icon: "CalendarCheck",
    allowedChildren: [],
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "text", label: "Text", type: "textarea", rows: 2 },
      { key: "buttonLabel", label: "Button text", type: "text" },
      { key: "buttonHref", label: "Button link", type: "url" },
      { key: "enquiryLabel", label: "Enquiry button text", type: "text" },
    ],
    defaultContent: { title: "Ready to travel?", buttonLabel: "Browse packages", buttonHref: "/packages", enquiryLabel: "Plan my trip" },
    defaultSettings: {},
  }),
  element({
    type: "whatsappCta",
    label: "WhatsApp CTA",
    category: "travel",
    icon: "MessageCircle",
    description: "Uses the WhatsApp number from Settings.",
    allowedChildren: [],
    fields: [
      { key: "label", label: "Button text", type: "text" },
      { key: "message", label: "Pre-filled message", type: "textarea", rows: 2 },
    ],
    defaultContent: { label: "Chat on WhatsApp", message: "Hi! I'd like to plan a trip." },
    defaultSettings: {},
  }),
  element({
    type: "relatedPackages",
    label: "Related packages",
    category: "travel",
    icon: "Link2",
    description: "Only meaningful on a package or destination page.",
    allowedChildren: [],
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "limit", label: "How many", type: "number", min: 1, max: 12 },
    ],
    defaultContent: { title: "You may also like", limit: 3 },
    defaultSettings: {},
  }),
  element({
    type: "relatedDestinations",
    label: "Related destinations",
    category: "travel",
    icon: "Compass",
    allowedChildren: [],
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "limit", label: "How many", type: "number", min: 1, max: 12 },
    ],
    defaultContent: { title: "Explore more destinations", limit: 4 },
    defaultSettings: {},
  }),
);

/* ── Marketing ── */
definitions.push(
  element({
    type: "hero",
    label: "Hero",
    category: "marketing",
    icon: "Sparkles",
    allowedChildren: [],
    fields: [
      { key: "badge", label: "Badge text", type: "text" },
      { key: "badgeIcon", label: "Badge icon", type: "icon" },
      { key: "title", label: "Headline", type: "text" },
      { key: "subtitle", label: "Sub-headline", type: "textarea", rows: 3 },
      { key: "image", label: "Background image", type: "image" },
      { key: "imageAlt", label: "Background alt text", type: "text" },
      { key: "primaryLabel", label: "Primary button", type: "text" },
      { key: "primaryHref", label: "Primary link", type: "url" },
      { key: "secondaryLabel", label: "Secondary button", type: "text" },
      {
        key: "secondaryAction",
        label: "Secondary button action",
        type: "select",
        options: [
          { value: "enquiry", label: "Open the enquiry form" },
          { value: "link", label: "Go to a link" },
        ],
      },
      { key: "secondaryHref", label: "Secondary link", type: "url" },
      { key: "height", label: "Minimum height", type: "select", options: [
        { value: "60vh", label: "Medium" },
        { value: "85vh", label: "Tall" },
        { value: "100vh", label: "Full screen" },
      ] },
    ],
    defaultContent: {
      title: "Your next journey starts here",
      subtitle: "Handcrafted holiday packages and effortless planning.",
      primaryLabel: "Explore packages",
      primaryHref: "/packages",
      secondaryLabel: "Plan my trip",
      secondaryAction: "enquiry",
      height: "85vh",
    },
    defaultSettings: { desktop: { overlay: "rgba(15,23,42,0.55)", color: "#ffffff" } },
  }),
  element({
    type: "cta",
    label: "Call to action",
    category: "marketing",
    icon: "Megaphone",
    allowedChildren: [],
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "text", label: "Text", type: "textarea", rows: 2 },
      { key: "buttonLabel", label: "Button text", type: "text" },
      { key: "buttonHref", label: "Button link", type: "url" },
      { key: "image", label: "Background image", type: "image" },
    ],
    defaultContent: { title: "Ready when you are", buttonLabel: "Get a free quote", buttonHref: "/contact" },
    defaultSettings: { desktop: { background: "#0d9488", color: "#ffffff", borderRadius: "24px", padding: { top: "48px", bottom: "48px", left: "32px", right: "32px" } } },
  }),
  element({
    type: "leadForm",
    label: "Lead form",
    category: "marketing",
    icon: "UserPlus",
    description: "Creates a real lead in the CRM.",
    allowedChildren: [],
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "subtitle", label: "Subtitle", type: "textarea", rows: 2 },
      { key: "buttonLabel", label: "Button text", type: "text" },
      { key: "source", label: "Lead source label", type: "text" },
      { key: "successMessage", label: "Thank-you message", type: "textarea", rows: 2 },
      { key: "compact", label: "Compact (name and phone only)", type: "switch" },
    ],
    defaultContent: { title: "Request a callback", buttonLabel: "Request callback", source: "callback-form", compact: true, successMessage: "Thanks — we'll call you back shortly." },
    defaultSettings: {},
  }),
  element({
    type: "newsletter",
    label: "Newsletter",
    category: "marketing",
    icon: "Mail",
    description: "Stores sign-ups as leads.",
    allowedChildren: [],
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "text", label: "Text", type: "textarea", rows: 2 },
      { key: "buttonLabel", label: "Button text", type: "text" },
      { key: "successMessage", label: "Thank-you message", type: "text" },
    ],
    defaultContent: { title: "Travel inspiration, monthly", buttonLabel: "Subscribe", successMessage: "You're subscribed." },
    defaultSettings: {},
  }),
  element({
    type: "trustBadges",
    label: "Trust badges",
    category: "marketing",
    icon: "ShieldCheck",
    allowedChildren: [],
    fields: [
      { key: "items", label: "Badges", type: "repeater", itemLabel: "Badge", max: 12, fields: [
        { key: "icon", label: "Icon", type: "icon" },
        { key: "title", label: "Title", type: "text" },
        { key: "text", label: "Text", type: "text" },
      ] },
    ],
    defaultContent: { items: [] },
    defaultSettings: { desktop: { columns: 4 }, tablet: { columns: 2 }, mobile: { columns: 1 } },
  }),
);

/** type → definition. */
export const ELEMENT_REGISTRY: Record<string, ElementDef> = Object.fromEntries(
  definitions.map((def) => [def.type, def]),
);

export const ELEMENT_TYPES = definitions.map((def) => def.type);

/** Types an admin can pick from the "add element" panel. */
export const INSERTABLE_TYPES = definitions.filter((def) => !def.internal).map((def) => def.type);

export function getElementDef(type: string): ElementDef | undefined {
  return ELEMENT_REGISTRY[type];
}

export function isKnownType(type: string): boolean {
  return type in ELEMENT_REGISTRY;
}

/**
 * Can `childType` be dropped inside `parentType`?
 *
 * This is what stops the builder producing structures the renderer cannot
 * handle — a section inside a heading, a column outside a columns row.
 */
export function canNest(parentType: string, childType: string): boolean {
  const parent = getElementDef(parentType);
  const child = getElementDef(childType);
  if (!parent || !child) return false;

  // A section is always top level; a column only ever sits in a columns row.
  if (childType === "section") return false;
  if (childType === "column") return parentType === "columns";

  if (parent.allowedChildren.includes(childType)) return true;
  if (parent.allowedChildren.includes(ANY_CONTENT)) return child.category !== "layout";
  return false;
}

/** Where a newly added element of this type can legally go. */
export function isTopLevelType(type: string): boolean {
  return type === "section";
}

export function elementsByCategory(): Record<ElementCategory, ElementDef[]> {
  const grouped: Record<ElementCategory, ElementDef[]> = {
    layout: [],
    basic: [],
    content: [],
    travel: [],
    marketing: [],
  };
  for (const def of definitions) {
    if (def.internal) continue;
    grouped[def.category].push(def);
  }
  return grouped;
}

/** Elements that fetch live database records rather than storing content. */
export const DYNAMIC_TYPES = [
  "packageGrid",
  "destinationGrid",
  "blogGrid",
  "categoryStrip",
  "testimonials",
  "relatedPackages",
  "relatedDestinations",
];
