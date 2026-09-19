import { describe, it, expect } from "vitest";
import { prepareDocument } from "@/lib/builder/prepare";
import { flattenNodes } from "@/lib/builder/tree";
import type { BuilderNode, PageDocument } from "@/lib/builder/schema";

/**
 * prepareDocument is the server-side gate for everything the builder saves.
 * These tests drive it the way a crafted request would — the editor's own
 * validation is not in the picture.
 */

const doc = (sections: BuilderNode[]): PageDocument => ({ version: 1, sections });

const section = (children: BuilderNode[]): BuilderNode => ({
  id: "sec",
  type: "section",
  children: [{ id: "con", type: "container", children }],
});

const admin = { allowRestricted: true };
const editor = { allowRestricted: false };

function contentOf(result: ReturnType<typeof prepareDocument>, id: string) {
  if (!result.ok) throw new Error(`expected ok, got: ${result.error}`);
  return flattenNodes(result.document).find((node) => node.id === id)?.content ?? {};
}

describe("prepareDocument — HTML sanitisation", () => {
  it("strips scripts from a rich text element", () => {
    const result = prepareDocument(
      doc([section([{ id: "rt", type: "richText", content: { html: '<p>Hi</p><script>alert(1)</script>' } }])]),
      editor,
    );
    const html = String(contentOf(result, "rt").html);
    expect(html).toContain("<p>Hi</p>");
    expect(html.toLowerCase()).not.toContain("script");
  });

  it("strips event handlers and javascript: links", () => {
    const result = prepareDocument(
      doc([
        section([
          {
            id: "rt",
            type: "richText",
            content: { html: '<a href="javascript:alert(1)" onclick="alert(2)">x</a><img src=x onerror=alert(3)>' },
          },
        ]),
      ]),
      editor,
    );
    const html = String(contentOf(result, "rt").html).toLowerCase();
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("onerror");
  });

  it("sanitises HTML inside repeater items, not just top-level fields", () => {
    const result = prepareDocument(
      doc([
        section([
          {
            id: "acc",
            type: "accordion",
            content: {
              items: [
                { title: "One", html: '<p>ok</p><script>alert(1)</script>' },
                { title: "Two", html: '<iframe src="https://evil.example"></iframe>' },
              ],
            },
          },
        ]),
      ]),
      editor,
    );
    const items = contentOf(result, "acc").items as Record<string, unknown>[];
    expect(String(items[0]!.html)).toContain("<p>ok</p>");
    expect(String(items[0]!.html).toLowerCase()).not.toContain("script");
    expect(String(items[1]!.html).toLowerCase()).not.toContain("<iframe");
    // Non-HTML keys in the same item are left alone.
    expect(items[0]!.title).toBe("One");
  });

  it("sanitises the restricted Custom HTML element too, even for an admin", () => {
    const result = prepareDocument(
      doc([section([{ id: "raw", type: "html", content: { html: '<div>keep</div><script>alert(1)</script>' } }])]),
      admin,
    );
    const html = String(contentOf(result, "raw").html);
    expect(html).toContain("keep");
    expect(html.toLowerCase()).not.toContain("script");
  });

  it("leaves ordinary content untouched", () => {
    const result = prepareDocument(
      doc([section([{ id: "h", type: "heading", content: { text: "5 > 3 & rising", tag: "h2" } }])]),
      editor,
    );
    expect(contentOf(result, "h")).toEqual({ text: "5 > 3 & rising", tag: "h2" });
  });
});

describe("prepareDocument — element permissions", () => {
  it("refuses the restricted element for a non-admin", () => {
    const result = prepareDocument(
      doc([section([{ id: "raw", type: "html", content: { html: "<b>x</b>" } }])]),
      editor,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("administrator");
  });

  it("allows it for an admin", () => {
    const result = prepareDocument(
      doc([section([{ id: "raw", type: "html", content: { html: "<b>x</b>" } }])]),
      admin,
    );
    expect(result.ok).toBe(true);
  });

  it("finds a restricted element however deeply it is buried", () => {
    const deep = doc([
      {
        id: "sec",
        type: "section",
        children: [
          {
            id: "con",
            type: "container",
            children: [
              {
                id: "cols",
                type: "columns",
                children: [
                  { id: "col", type: "column", children: [{ id: "raw", type: "html", content: {} }] },
                ],
              },
            ],
          },
        ],
      },
    ]);
    expect(prepareDocument(deep, editor).ok).toBe(false);
  });
});

describe("prepareDocument — structural rejection", () => {
  it("rejects an element type the registry does not know", () => {
    const result = prepareDocument(
      doc([section([{ id: "x", type: "evilWidget", content: {} }])]),
      admin,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Unknown element type");
  });

  it("rejects an invalid document before doing any work on it", () => {
    expect(prepareDocument({ sections: [{ id: "dup", type: "section" }, { id: "dup", type: "section" }] }, admin).ok)
      .toBe(false);
    expect(prepareDocument("nonsense", admin).ok).toBe(false);
    expect(prepareDocument(null, admin).ok).toBe(false);
  });

  it("accepts an empty document", () => {
    const result = prepareDocument({ version: 1, sections: [] }, editor);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.document.sections).toEqual([]);
  });

  it("does not mutate the input it was given", () => {
    const input = doc([section([{ id: "rt", type: "richText", content: { html: "<script>x</script>" } }])]);
    const snapshot = JSON.stringify(input);
    prepareDocument(input, admin);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
