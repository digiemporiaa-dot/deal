import { describe, it, expect } from "vitest";
import {
  validateDocument,
  parseDocument,
  EMPTY_DOCUMENT,
  MAX_DEPTH,
  MAX_NODES,
  type BuilderNode,
  type PageDocument,
} from "@/lib/builder/schema";
import {
  canNest,
  getElementDef,
  isKnownType,
  isTopLevelType,
  INSERTABLE_TYPES,
  ELEMENT_TYPES,
  elementsByCategory,
} from "@/lib/builder/registry";
import {
  createId,
  createNode,
  createSectionWith,
  countNodes,
  duplicateNode,
  emptyDocument,
  findNode,
  flattenNodes,
  insertNode,
  isDescendant,
  moveNode,
  moveSection,
  regenerateIds,
  removeNode,
  setColumnCount,
  updateNode,
} from "@/lib/builder/tree";
import {
  safeCssValue,
  resolveStyle,
  nodeCss,
  customClassName,
  customElementId,
  isHiddenAt,
  isHiddenEverywhere,
} from "@/lib/builder/styles";
import { safeHref, safeImageSrc, headingTag, embedUrl, linkAttributes, lines } from "@/lib/builder/content";
import { builtInTemplates } from "@/lib/builder/builtin-templates";
import { isReservedSlug, pathForSlug, CMS_ROUTES } from "@/lib/builder/routes";

/* ────────────────────── helpers ────────────────────── */

const node = (id: string, type: string, children?: BuilderNode[]): BuilderNode => ({
  id,
  type,
  ...(children ? { children } : {}),
});

const doc = (sections: BuilderNode[]): PageDocument => ({ version: 1, sections });

/** A section > container > heading tree, which is the shape the editor builds. */
function sampleDoc(): PageDocument {
  return doc([
    node("sec1", "section", [
      node("con1", "container", [node("h1", "heading"), node("t1", "text")]),
    ]),
    node("sec2", "section", [node("con2", "container", [])]),
  ]);
}

/* ────────────────────── schema validation ────────────────────── */

describe("validateDocument", () => {
  it("accepts a well-formed document", () => {
    const result = validateDocument(sampleDoc());
    expect(result.ok).toBe(true);
  });

  it("rejects duplicate ids — they break selection, keys and drag-and-drop", () => {
    const result = validateDocument(
      doc([node("same", "section", [node("con", "container", [node("same", "heading")])])]),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Duplicate");
  });

  it("rejects a tree deeper than the limit", () => {
    let deepest: BuilderNode = node("leaf", "heading");
    for (let i = 0; i < MAX_DEPTH + 2; i += 1) {
      deepest = node(`n${i}`, "container", [deepest]);
    }
    const result = validateDocument(doc([node("root", "section", [deepest])]));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("nested too deeply");
  });

  it("rejects a document with too many nodes in total", () => {
    // Spread across sections, since a single children array is capped first.
    const sections = Array.from({ length: 20 }, (_, s) =>
      node(
        `sec${s}`,
        "section",
        Array.from({ length: 150 }, (_, i) => node(`n${s}_${i}`, "heading")),
      ),
    );
    expect(countNodes(doc(sections))).toBeGreaterThan(MAX_NODES);
    const result = validateDocument(doc(sections));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("too many elements");
  });

  it("caps a single children array well below the total limit", () => {
    const children = Array.from({ length: 250 }, (_, i) => node(`n${i}`, "heading"));
    expect(validateDocument(doc([node("sec", "section", children)])).ok).toBe(false);
  });

  it("rejects an id with characters that would escape a CSS selector", () => {
    expect(validateDocument(doc([node('a"]{x', "section")])).ok).toBe(false);
  });

  it("rejects an out-of-range style value rather than silently clamping it", () => {
    const bad = doc([{ id: "s", type: "section", settings: { desktop: { opacity: 4 } } }]);
    expect(validateDocument(bad).ok).toBe(false);
  });

  it("rejects an advanced class containing anything but the safe character set", () => {
    const bad = doc([
      { id: "s", type: "section", settings: { advanced: { customClass: 'x" onload="' } } },
    ]);
    expect(validateDocument(bad).ok).toBe(false);
  });
});

describe("parseDocument", () => {
  it("never throws — a corrupt row renders as an empty page, not a 500", () => {
    expect(parseDocument(null)).toEqual(EMPTY_DOCUMENT);
    expect(parseDocument("not json")).toEqual(EMPTY_DOCUMENT);
    expect(parseDocument({ version: 1, sections: "nope" })).toEqual(EMPTY_DOCUMENT);
    expect(parseDocument({ sections: [{ id: "dup", type: "section" }, { id: "dup", type: "section" }] }))
      .toEqual(EMPTY_DOCUMENT);
  });

  it("returns the parsed document when it is valid", () => {
    expect(parseDocument(sampleDoc()).sections).toHaveLength(2);
  });
});

/* ────────────────────── registry / nesting rules ────────────────────── */

describe("canNest", () => {
  it("never allows a section inside anything", () => {
    for (const type of ELEMENT_TYPES) expect(canNest(type, "section")).toBe(false);
  });

  it("only allows a column directly inside columns", () => {
    expect(canNest("columns", "column")).toBe(true);
    expect(canNest("container", "column")).toBe(false);
    expect(canNest("section", "column")).toBe(false);
  });

  it("allows content elements inside a container or a column", () => {
    expect(canNest("container", "heading")).toBe(true);
    expect(canNest("column", "heading")).toBe(true);
    expect(canNest("column", "packageGrid")).toBe(true);
  });

  it("refuses to nest a layout element via the content wildcard", () => {
    // `container` accepts "*content", which must not quietly mean "anything".
    expect(canNest("column", "section")).toBe(false);
  });

  it("refuses children inside a leaf element", () => {
    expect(canNest("heading", "text")).toBe(false);
    expect(canNest("image", "heading")).toBe(false);
  });

  it("refuses an unknown type on either side", () => {
    expect(canNest("container", "definitelyNotAnElement")).toBe(false);
    expect(canNest("definitelyNotAnElement", "heading")).toBe(false);
  });
});

describe("element registry", () => {
  it("has a unique, known definition for every insertable type", () => {
    expect(new Set(ELEMENT_TYPES).size).toBe(ELEMENT_TYPES.length);
    for (const type of INSERTABLE_TYPES) {
      expect(isKnownType(type)).toBe(true);
      expect(getElementDef(type)?.label).toBeTruthy();
    }
  });

  it("hides internal types from the library but offers sections", () => {
    // A column only exists inside a columns element, so adding one directly
    // would produce a node with nowhere legal to live.
    expect(INSERTABLE_TYPES).not.toContain("column");
    expect(INSERTABLE_TYPES).toContain("section");
  });

  it("puts every insertable element in exactly one category group", () => {
    const grouped = elementsByCategory();
    const listed = Object.values(grouped).flat().map((def) => def.type);
    expect(new Set(listed).size).toBe(listed.length);
    for (const type of INSERTABLE_TYPES) expect(listed).toContain(type);
  });

  it("treats only a section as top level", () => {
    expect(isTopLevelType("section")).toBe(true);
    expect(isTopLevelType("heading")).toBe(false);
  });
});

/* ────────────────────── tree operations ────────────────────── */

describe("createId", () => {
  it("is never an array index — ids must survive reordering", () => {
    const ids = Array.from({ length: 500 }, () => createId("n"));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^[a-zA-Z0-9_-]+$/.test(id))).toBe(true);
    expect(ids).not.toContain("0");
  });
});

describe("createNode / createSectionWith", () => {
  it("applies the registry defaults", () => {
    const heading = createNode("heading");
    expect(heading.type).toBe("heading");
    expect(heading.content?.text).toBe(getElementDef("heading")?.defaultContent.text);
  });

  it("wraps a content element in section > container", () => {
    const section = createSectionWith("heading");
    expect(section.type).toBe("section");
    expect(section.children?.[0]?.type).toBe("container");
    expect(section.children?.[0]?.children?.[0]?.type).toBe("heading");
    expect(validateDocument(doc([section])).ok).toBe(true);
  });
});

describe("findNode", () => {
  it("finds a nested node with its parent and index", () => {
    const found = findNode(sampleDoc(), "t1");
    expect(found?.node.type).toBe("text");
    expect(found?.parent?.id).toBe("con1");
    expect(found?.index).toBe(1);
  });

  it("returns null for an unknown id", () => {
    expect(findNode(sampleDoc(), "nope")).toBeNull();
  });
});

describe("updateNode", () => {
  it("merges content without dropping the other keys", () => {
    const start = doc([node("sec", "section", [{ id: "h", type: "heading", content: { text: "A", tag: "h2" } }])]);
    const next = updateNode(start, "h", { content: { text: "B" } });
    const found = findNode(next, "h");
    expect(found?.node.content).toEqual({ text: "B", tag: "h2" });
  });

  it("merges one breakpoint at a time, so a tablet edit cannot wipe desktop", () => {
    const start = doc([
      { id: "s", type: "section", settings: { desktop: { fontSize: "32px", color: "#000" } } },
    ]);
    const next = updateNode(start, "s", { settings: { tablet: { fontSize: "24px" } } });
    const settings = findNode(next, "s")?.node.settings;
    expect(settings?.desktop).toEqual({ fontSize: "32px", color: "#000" });
    expect(settings?.tablet).toEqual({ fontSize: "24px" });
  });

  it("does not mutate the document it was given", () => {
    const start = sampleDoc();
    const snapshot = JSON.stringify(start);
    updateNode(start, "h1", { content: { text: "changed" } });
    expect(JSON.stringify(start)).toBe(snapshot);
  });
});

describe("removeNode", () => {
  it("removes a nested node and leaves the rest intact", () => {
    const next = removeNode(sampleDoc(), "t1");
    expect(findNode(next, "t1")).toBeNull();
    expect(findNode(next, "h1")).not.toBeNull();
  });

  it("removes a whole section", () => {
    const next = removeNode(sampleDoc(), "sec1");
    expect(next.sections).toHaveLength(1);
    expect(findNode(next, "h1")).toBeNull();
  });
});

describe("regenerateIds / duplicateNode", () => {
  it("gives every node in a copied branch a fresh id", () => {
    const original = sampleDoc().sections[0]!;
    const copy = regenerateIds(original);
    const originalIds = flattenNodes(doc([original])).map((n) => n.id);
    const copyIds = flattenNodes(doc([copy])).map((n) => n.id);
    expect(copyIds).toHaveLength(originalIds.length);
    expect(copyIds.some((id) => originalIds.includes(id))).toBe(false);
  });

  it("inserts the duplicate right after the original and keeps the document valid", () => {
    const next = duplicateNode(sampleDoc(), "h1");
    const siblings = findNode(next, "con1")!.node.children!;
    expect(siblings).toHaveLength(3);
    expect(siblings[1]!.type).toBe("heading");
    expect(siblings[1]!.id).not.toBe("h1");
    expect(validateDocument(next).ok).toBe(true);
  });

  it("duplicates a section at the top level", () => {
    const next = duplicateNode(sampleDoc(), "sec1");
    expect(next.sections).toHaveLength(3);
    expect(validateDocument(next).ok).toBe(true);
  });
});

describe("insertNode", () => {
  it("inserts at the requested index", () => {
    const next = insertNode(sampleDoc(), node("new", "heading"), { parentId: "con1", index: 0 });
    expect(findNode(next, "con1")!.node.children!.map((n) => n.id)).toEqual(["new", "h1", "t1"]);
  });

  it("appends when no index is given", () => {
    const next = insertNode(sampleDoc(), node("new", "heading"), { parentId: "con1" });
    expect(findNode(next, "con1")!.node.children!.at(-1)!.id).toBe("new");
  });

  it("refuses a nesting the registry forbids", () => {
    const before = sampleDoc();
    const after = insertNode(before, node("new", "section"), { parentId: "con1" });
    expect(after).toEqual(before);
  });
});

describe("moveNode", () => {
  it("moves a node between parents", () => {
    const next = moveNode(sampleDoc(), "t1", { parentId: "con2", index: 0 });
    expect(findNode(next, "con1")!.node.children!.map((n) => n.id)).toEqual(["h1"]);
    expect(findNode(next, "con2")!.node.children!.map((n) => n.id)).toEqual(["t1"]);
  });

  it("adjusts the index when reordering inside the same parent", () => {
    // Dropping "h1" into slot 2 of its own parent means "after t1".
    const next = moveNode(sampleDoc(), "h1", { parentId: "con1", index: 2 });
    expect(findNode(next, "con1")!.node.children!.map((n) => n.id)).toEqual(["t1", "h1"]);
  });

  it("refuses to move a node into its own subtree", () => {
    const before = sampleDoc();
    expect(moveNode(before, "sec1", { parentId: "con1" })).toEqual(before);
    expect(moveNode(before, "con1", { parentId: "con1" })).toEqual(before);
  });

  it("refuses to put a non-section at the top level", () => {
    const before = sampleDoc();
    expect(moveNode(before, "h1", { parentId: null, index: 0 })).toEqual(before);
  });

  it("refuses a move the nesting rules forbid", () => {
    const before = sampleDoc();
    expect(moveNode(before, "h1", { parentId: "t1" })).toEqual(before);
  });

  it("keeps the node count unchanged on a legal move", () => {
    const before = sampleDoc();
    const after = moveNode(before, "t1", { parentId: "con2", index: 0 });
    expect(countNodes(after)).toBe(countNodes(before));
  });
});

describe("isDescendant", () => {
  it("reports descendants at any depth but not the node itself", () => {
    const section = sampleDoc().sections[0]!;
    expect(isDescendant(section, "h1")).toBe(true);
    expect(isDescendant(section, "sec1")).toBe(false);
    expect(isDescendant(section, "sec2")).toBe(false);
  });
});

describe("moveSection", () => {
  it("reorders sections and ignores a move past either end", () => {
    const start = sampleDoc();
    expect(moveSection(start, "sec2", -1).sections.map((s) => s.id)).toEqual(["sec2", "sec1"]);
    expect(moveSection(start, "sec1", -1)).toEqual(start);
    expect(moveSection(start, "sec2", 1)).toEqual(start);
  });
});

describe("setColumnCount", () => {
  const columnsDoc = () =>
    doc([
      node("sec", "section", [
        node("cols", "columns", [
          node("c1", "column", [node("a", "heading")]),
          node("c2", "column", [node("b", "text")]),
        ]),
      ]),
    ]);

  it("adds empty columns when growing", () => {
    const next = setColumnCount(columnsDoc(), "cols", 4);
    const children = findNode(next, "cols")!.node.children!;
    expect(children).toHaveLength(4);
    expect(children.every((c) => c.type === "column")).toBe(true);
    expect(validateDocument(next).ok).toBe(true);
  });

  it("never bins content when shrinking — it moves to the last column", () => {
    const next = setColumnCount(columnsDoc(), "cols", 1);
    const children = findNode(next, "cols")!.node.children!;
    expect(children).toHaveLength(1);
    expect(children[0]!.children!.map((n) => n.id)).toEqual(["a", "b"]);
  });

  it("keeps the preset and the desktop column count in step", () => {
    const next = setColumnCount(columnsDoc(), "cols", 3);
    const cols = findNode(next, "cols")!.node;
    expect(cols.content?.preset).toBe("3");
    expect(cols.settings?.desktop?.columns).toBe(3);
  });

  it("clamps to the supported range", () => {
    expect(findNode(setColumnCount(columnsDoc(), "cols", 99), "cols")!.node.children).toHaveLength(6);
    expect(findNode(setColumnCount(columnsDoc(), "cols", 0), "cols")!.node.children).toHaveLength(1);
  });
});

describe("countNodes / flattenNodes / emptyDocument", () => {
  it("counts and flattens every node in the tree", () => {
    expect(countNodes(sampleDoc())).toBe(6);
    expect(flattenNodes(sampleDoc()).map((n) => n.id)).toEqual([
      "sec1",
      "con1",
      "h1",
      "t1",
      "sec2",
      "con2",
    ]);
  });

  it("hands out a fresh empty document each time", () => {
    const a = emptyDocument();
    a.sections.push(node("x", "section"));
    expect(emptyDocument().sections).toHaveLength(0);
  });
});

/* ────────────────────── CSS generation ────────────────────── */

describe("safeCssValue", () => {
  it("keeps ordinary values", () => {
    expect(safeCssValue("16px")).toBe("16px");
    expect(safeCssValue("rgba(15,23,42,0.6)")).toBe("rgba(15,23,42,0.6)");
    expect(safeCssValue("linear-gradient(90deg, #fff, #000)")).toContain("linear-gradient");
  });

  it("strips the characters that would let a value escape its own rule", () => {
    const out = safeCssValue("red; } body { display:none } .x {");
    expect(out).not.toContain("{");
    expect(out).not.toContain("}");
    expect(out).not.toContain(";");
  });

  it("removes comment markers, expression() and script pseudo-protocols", () => {
    expect(safeCssValue("/* x */red")).not.toContain("/*");
    expect(safeCssValue("expression(alert(1))").toLowerCase()).not.toContain("expression(");
    expect(safeCssValue("javascript:alert(1)").toLowerCase()).not.toContain("javascript:");
    expect(safeCssValue("JavaScript : alert(1)").toLowerCase()).not.toContain("javascript");
    expect(safeCssValue("behavior:url(x.htc)").toLowerCase()).not.toContain("behavior:");
  });

  it("strips angle brackets, so a value cannot close the style element", () => {
    const out = safeCssValue("red</style><script>alert(1)</script>");
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
  });

  it("bounds the length and handles empties", () => {
    expect(safeCssValue("a".repeat(1000))).toHaveLength(300);
    expect(safeCssValue(undefined)).toBe("");
    expect(safeCssValue("   ")).toBe("");
  });
});

describe("resolveStyle", () => {
  const settings = {
    desktop: { fontSize: "32px", color: "#000", textAlign: "left" as const },
    tablet: { fontSize: "24px" },
    mobile: { fontSize: "18px" },
  };

  it("cascades desktop → tablet → mobile", () => {
    expect(resolveStyle(settings, "desktop").fontSize).toBe("32px");
    expect(resolveStyle(settings, "tablet").fontSize).toBe("24px");
    expect(resolveStyle(settings, "mobile").fontSize).toBe("18px");
  });

  it("inherits anything a breakpoint does not override", () => {
    expect(resolveStyle(settings, "mobile").color).toBe("#000");
    expect(resolveStyle(settings, "mobile").textAlign).toBe("left");
  });

  it("handles missing settings", () => {
    expect(resolveStyle(undefined, "mobile")).toEqual({});
  });
});

describe("nodeCss", () => {
  it("scopes every rule to the node's data attribute", () => {
    const css = nodeCss("abc123", { desktop: { color: "#fff" } });
    expect(css).toContain('[data-b="abc123"]{');
    expect(css).toContain("color:#fff");
  });

  it("emits overrides as media queries, smaller breakpoints last", () => {
    const css = nodeCss("n1", {
      desktop: { fontSize: "32px" },
      tablet: { fontSize: "24px" },
      mobile: { fontSize: "18px" },
    });
    expect(css.indexOf("max-width:1024px")).toBeGreaterThan(-1);
    expect(css.indexOf("max-width:640px")).toBeGreaterThan(css.indexOf("max-width:1024px"));
  });

  it("does not repeat a value the breakpoint above already set", () => {
    const css = nodeCss("n1", { desktop: { fontSize: "32px" }, tablet: {} });
    expect(css).not.toContain("max-width:1024px");
  });

  it("emits per-device visibility rules that cover each width once", () => {
    expect(nodeCss("n1", { hidden: { mobile: true } })).toContain(
      "@media (max-width:640px){[data-b=\"n1\"]{display:none}}",
    );
    expect(nodeCss("n1", { hidden: { desktop: true } })).toContain("min-width:1025px");
    expect(nodeCss("n1", { hidden: { tablet: true } })).toContain(
      "(min-width:641px) and (max-width:1024px)",
    );
  });

  it("refuses to build a selector from an unsafe id", () => {
    expect(nodeCss('x"]{color:red}[data-b="y', { desktop: { color: "#fff" } })).toBe("");
  });

  it("cannot be used to inject a rule through a style value", () => {
    // The value is mangled into nonsense the CSS parser drops; what matters
    // is that it stays one declaration inside one rule and cannot open a new
    // selector block of its own.
    const css = nodeCss("n1", { desktop: { color: "#fff;}body{display:none" } });
    expect(css.match(/\{/g)).toHaveLength(1);
    expect(css.match(/\}/g)).toHaveLength(1);
    expect(css).toBe('[data-b="n1"]{color:#fffbodydisplay:none}');
  });

  it("returns nothing when there is nothing to style", () => {
    expect(nodeCss("n1", undefined)).toBe("");
    expect(nodeCss("n1", {})).toBe("");
  });
});

describe("customClassName / customElementId", () => {
  it("keeps a normal class list and id", () => {
    expect(customClassName({ advanced: { customClass: "my-class other" } })).toBe("my-class other");
    expect(customElementId({ advanced: { customId: "book-now" } })).toBe("book-now");
  });

  it("strips anything that could break out of the attribute", () => {
    expect(customClassName({ advanced: { customClass: 'a" onclick="alert(1)' } })).not.toContain('"');
    expect(customElementId({ advanced: { customId: 'a"><script>' } })).not.toContain("<");
  });

  it("returns empty when unset", () => {
    expect(customClassName(undefined)).toBe("");
    expect(customElementId(undefined)).toBeUndefined();
  });
});

describe("visibility helpers", () => {
  it("reports hidden per breakpoint", () => {
    expect(isHiddenAt({ hidden: { mobile: true } }, "mobile")).toBe(true);
    expect(isHiddenAt({ hidden: { mobile: true } }, "desktop")).toBe(false);
  });

  it("only reports hidden-everywhere when all three are set", () => {
    expect(isHiddenEverywhere({ hidden: { desktop: true, tablet: true, mobile: true } })).toBe(true);
    expect(isHiddenEverywhere({ hidden: { desktop: true, tablet: true } })).toBe(false);
    expect(isHiddenEverywhere(undefined)).toBe(false);
  });
});

/* ────────────────────── content helpers ────────────────────── */

describe("safeHref", () => {
  it("keeps real links", () => {
    expect(safeHref("https://example.com/x")).toBe("https://example.com/x");
    expect(safeHref("/packages")).toBe("/packages");
    expect(safeHref("#faq")).toBe("#faq");
    expect(safeHref("mailto:a@b.com")).toBe("mailto:a@b.com");
    expect(safeHref("tel:+911234567890")).toBe("tel:+911234567890");
  });

  it("blocks script pseudo-protocols, including obfuscated ones", () => {
    expect(safeHref("javascript:alert(1)")).toBe("#");
    expect(safeHref("JaVaScRiPt:alert(1)")).toBe("#");
    expect(safeHref("java\tscript:alert(1)")).toBe("#");
    expect(safeHref("java\nscript:alert(1)")).toBe("#");
    expect(safeHref(" javascript:alert(1)")).toBe("#");
    expect(safeHref("vbscript:msgbox(1)")).toBe("#");
    expect(safeHref("data:text/html;base64,PHNjcmlwdD4=")).toBe("#");
  });

  it("treats a bare word as a site-relative path", () => {
    expect(safeHref("about")).toBe("/about");
  });

  it("falls back to # for anything that is not a string", () => {
    expect(safeHref(undefined)).toBe("#");
    expect(safeHref(42)).toBe("#");
    expect(safeHref("")).toBe("#");
  });
});

describe("safeImageSrc", () => {
  it("allows uploads and absolute http(s) sources", () => {
    expect(safeImageSrc("/uploads/a.jpg")).toBe("/uploads/a.jpg");
    expect(safeImageSrc("https://images.example.com/a.jpg")).toBe("https://images.example.com/a.jpg");
  });

  it("rejects anything else", () => {
    expect(safeImageSrc("javascript:alert(1)")).toBeNull();
    expect(safeImageSrc("data:image/svg+xml,<svg onload=alert(1)>")).toBeNull();
    expect(safeImageSrc(null)).toBeNull();
  });
});

describe("headingTag / embedUrl / linkAttributes / lines", () => {
  it("only emits an allowed heading tag", () => {
    expect(headingTag("h1")).toBe("h1");
    expect(headingTag("script")).toBe("h2");
    expect(headingTag(undefined, "h3")).toBe("h3");
  });

  it("converts known video URLs and rejects the rest", () => {
    expect(embedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    );
    expect(embedUrl("https://youtu.be/dQw4w9WgXcQ")).toContain("youtube-nocookie.com/embed/");
    expect(embedUrl("https://vimeo.com/123456789")).toBe("https://player.vimeo.com/video/123456789");
    expect(embedUrl("https://evil.example.com/x")).toBeNull();
    expect(embedUrl("javascript:alert(1)")).toBeNull();
  });

  it("pairs target=_blank with a safe rel", () => {
    expect(linkAttributes({ newTab: true }).rel).toContain("noopener");
    expect(linkAttributes({ newTab: true }).target).toBe("_blank");
    expect(linkAttributes({ nofollow: true }).rel).toContain("nofollow");
    expect(linkAttributes({}).target).toBeUndefined();
  });

  it("splits a textarea into trimmed non-empty lines", () => {
    expect(lines({ items: "a\n\n b \nc" }, "items")).toEqual(["a", "b", "c"]);
    expect(lines(undefined, "items")).toEqual([]);
  });
});

/* ────────────────────── shipped templates and routes ────────────────────── */

describe("builtInTemplates", () => {
  const templates = builtInTemplates();

  it("ships page and section templates with unique slugs", () => {
    expect(templates.length).toBeGreaterThan(8);
    expect(new Set(templates.map((t) => t.slug)).size).toBe(templates.length);
    expect(templates.some((t) => t.kind === "page")).toBe(true);
    expect(templates.some((t) => t.kind === "section")).toBe(true);
  });

  it("produces a document that passes validation", () => {
    for (const template of templates) {
      const result = validateDocument(template.content);
      expect(result.ok, `${template.slug}: ${result.ok ? "" : result.error}`).toBe(true);
    }
  });

  it("only uses element types the registry knows and legal nestings", () => {
    for (const template of templates) {
      for (const section of template.content.sections) {
        expect(section.type).toBe("section");
        const walk = (parent: BuilderNode) => {
          for (const child of parent.children ?? []) {
            expect(isKnownType(child.type), `${template.slug}: ${child.type}`).toBe(true);
            expect(canNest(parent.type, child.type), `${template.slug}: ${parent.type} > ${child.type}`).toBe(true);
            walk(child);
          }
        };
        walk(section);
      }
    }
  });

  it("gives every node in the library a distinct id", () => {
    const ids = templates.flatMap((t) => flattenNodes(t.content).map((n) => n.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps the homepage template recognisable", () => {
    const home = templates.find((t) => t.slug === "homepage")!;
    const types = flattenNodes(home.content).map((n) => n.type);
    expect(types).toContain("hero");
    expect(types).toContain("destinationGrid");
    expect(types).toContain("packageGrid");
    expect(types).toContain("testimonials");
    expect(types).toContain("blogGrid");
  });
});

describe("route rules", () => {
  it("reserves the slugs a static route already owns", () => {
    expect(isReservedSlug("packages")).toBe(true);
    expect(isReservedSlug("Admin")).toBe(true);
    expect(isReservedSlug(" api ")).toBe(true);
    expect(isReservedSlug("about")).toBe(false);
  });

  it("leaves CMS-overridable routes available", () => {
    for (const slug of Object.keys(CMS_ROUTES)) expect(isReservedSlug(slug)).toBe(false);
  });

  it("maps an overriding slug to the path it actually renders at", () => {
    expect(pathForSlug("home")).toBe("/");
    expect(pathForSlug("contact")).toBe("/contact");
    expect(pathForSlug("about")).toBe("/about");
  });
});
