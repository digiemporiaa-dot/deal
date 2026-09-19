/**
 * Allow-list HTML sanitiser for admin-authored rich text.
 *
 * Page and blog bodies are written in the admin editor and rendered with
 * `dangerouslySetInnerHTML`, so they are stored XSS if taken at face value —
 * an EDITOR is a low-privilege role and should not be able to run script in a
 * visitor's browser. Everything not on the lists below is dropped.
 *
 * This is a conservative, dependency-free sanitiser: it removes whole
 * dangerous elements, unknown tags (keeping their text), every `on*` handler,
 * and any URL scheme other than http/https/mailto/tel and relative paths.
 */

const ALLOWED_TAGS = new Set([
  "p", "br", "hr", "span", "div",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "strong", "b", "em", "i", "u", "s", "sub", "sup", "mark", "small",
  "ul", "ol", "li",
  "blockquote", "pre", "code",
  "a", "img", "figure", "figcaption",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col",
]);

/** Elements removed together with everything inside them. */
const VOID_OUT_TAGS = ["script", "style", "iframe", "object", "embed", "noscript", "template", "svg", "math", "form"];

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "title", "target", "rel"]),
  img: new Set(["src", "alt", "title", "width", "height", "loading", "decoding"]),
  td: new Set(["colspan", "rowspan"]),
  th: new Set(["colspan", "rowspan", "scope"]),
  col: new Set(["span"]),
  colgroup: new Set(["span"]),
};

/** Attributes allowed on any permitted element. */
const GLOBAL_ATTRS = new Set(["class", "id", "dir", "lang"]);

const SAFE_URL = /^(https?:\/\/|mailto:|tel:|\/|#|\.\/|\.\.\/)/i;

function isSafeUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  // Strip HTML entities and whitespace tricks like "java\tscript:".
  const flattened = trimmed.replace(/[\s\u0000-\u001f]/g, "").toLowerCase();
  if (flattened.startsWith("javascript:") || flattened.startsWith("vbscript:")) return false;
  if (flattened.startsWith("data:") && !flattened.startsWith("data:image/")) return false;
  if (flattened.startsWith("data:image/svg")) return false; // SVG can carry script
  return SAFE_URL.test(trimmed) || flattened.startsWith("data:image/");
}

function sanitizeAttributes(tag: string, attrString: string): string {
  const allowed = ALLOWED_ATTRS[tag];
  const out: string[] = [];

  const attrPattern = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*("[^"]*"|'[^']*'|[^\s"'>]+))?/g;
  let match: RegExpExecArray | null;

  while ((match = attrPattern.exec(attrString)) !== null) {
    const name = match[1]!.toLowerCase();
    let value = match[2] ?? "";
    if (value.startsWith('"') || value.startsWith("'")) value = value.slice(1, -1);

    if (name.startsWith("on")) continue; // every event handler
    if (name === "style") continue; // expression()/url() tricks
    if (!GLOBAL_ATTRS.has(name) && !allowed?.has(name)) continue;

    if ((name === "href" || name === "src") && !isSafeUrl(value)) continue;

    if (value === "") {
      out.push(name);
    } else {
      out.push(`${name}="${escapeAttr(value)}"`);
    }
  }

  // Outbound links opened in a new tab must not hand over `window.opener`.
  if (tag === "a" && out.some((a) => a.startsWith('target="_blank"'))) {
    if (!out.some((a) => a.startsWith("rel="))) out.push('rel="noopener noreferrer"');
  }
  // Images without lazy loading cause needless work on long pages.
  if (tag === "img" && !out.some((a) => a.startsWith("loading="))) {
    out.push('loading="lazy"');
    out.push('decoding="async"');
  }

  return out.length ? ` ${out.join(" ")}` : "";
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Sanitise a rich-text HTML fragment. Returns an empty string for junk input. */
export function sanitizeHtml(input: string | null | undefined): string {
  if (!input) return "";
  let html = String(input);

  // 1. Drop dangerous elements together with their contents.
  for (const tag of VOID_OUT_TAGS) {
    html = html.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, "gi"), "");
    html = html.replace(new RegExp(`<${tag}\\b[^>]*\\/?>`, "gi"), "");
  }

  // 2. Remove comments (they can hide conditional-comment script in old IE).
  html = html.replace(/<!--[\s\S]*?-->/g, "");

  // 3. Walk the remaining tags, keeping only what is on the allow-list.
  html = html.replace(
    /<\s*(\/)?\s*([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g,
    (_full, closing: string | undefined, rawTag: string, attrs: string) => {
      const tag = rawTag.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) return ""; // unknown tag: keep inner text, drop the tag
      if (closing) return `</${tag}>`;
      const selfClosing = /\/\s*$/.test(attrs);
      const cleaned = sanitizeAttributes(tag, attrs.replace(/\/\s*$/, ""));
      return selfClosing || tag === "br" || tag === "hr" || tag === "img"
        ? `<${tag}${cleaned} />`
        : `<${tag}${cleaned}>`;
    },
  );

  return html.trim();
}

/** Strip every tag — for excerpts, meta descriptions and search snippets. */
export function stripHtml(input: string | null | undefined): string {
  if (!input) return "";
  return String(input)
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Plain text trimmed to a length, ending on a word boundary. */
export function excerptFrom(html: string | null | undefined, maxLength = 160): string {
  const text = stripHtml(html);
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
