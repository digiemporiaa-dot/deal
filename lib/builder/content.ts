import type { NodeContent } from "@/lib/builder/schema";

/**
 * Typed readers for element content.
 *
 * Content is stored as loose JSON, so every read from it is untrusted: a field
 * an admin never filled in, or one left over from an older version of an
 * element, must not crash a public page. These helpers always return something
 * usable.
 */

export function str(content: NodeContent | undefined, key: string, fallback = ""): string {
  const value = content?.[key];
  return typeof value === "string" ? value : fallback;
}

export function num(content: NodeContent | undefined, key: string, fallback: number): number {
  const value = Number(content?.[key]);
  return Number.isFinite(value) ? value : fallback;
}

export function bool(content: NodeContent | undefined, key: string, fallback = false): boolean {
  const value = content?.[key];
  return typeof value === "boolean" ? value : fallback;
}

export function list(content: NodeContent | undefined, key: string): Record<string, unknown>[] {
  const value = content?.[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
}

/** Read one field out of a repeater item. */
export function itemStr(item: Record<string, unknown>, key: string, fallback = ""): string {
  const value = item[key];
  return typeof value === "string" ? value : fallback;
}

/** A textarea where each line is one value. */
export function lines(content: NodeContent | undefined, key: string): string[] {
  return str(content, key)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * A link an admin typed, restricted to site-relative paths, absolute http(s)
 * URLs, anchors, `mailto:` and `tel:`. Anything else — `javascript:` above
 * all — becomes an inert "#".
 */
export function safeHref(value: unknown): string {
  if (typeof value !== "string") return "#";
  const raw = value.trim();
  if (!raw) return "#";
  const flattened = raw.replace(/[\s\u0000-\u001f]/g, "").toLowerCase();
  if (flattened.startsWith("javascript:") || flattened.startsWith("vbscript:")) return "#";
  if (flattened.startsWith("data:")) return "#";
  if (/^(https?:\/\/|\/|#|mailto:|tel:)/i.test(raw)) return raw;
  // A bare word is treated as a site-relative path rather than rejected.
  return `/${raw.replace(/^\/+/, "")}`;
}

/** An image URL, allowing site-relative uploads and absolute https sources. */
export function safeImageSrc(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw) || raw.startsWith("/")) return raw;
  return null;
}

/** `target` and `rel` for a link, honouring the element's own settings. */
export function linkAttributes(content: NodeContent | undefined): {
  target?: "_blank";
  rel?: string;
} {
  const newTab = bool(content, "newTab");
  const nofollow = bool(content, "nofollow");

  const rel = [nofollow ? "nofollow" : "", newTab ? "noopener noreferrer" : ""]
    .filter(Boolean)
    .join(" ");

  return {
    ...(newTab ? { target: "_blank" as const } : {}),
    ...(rel ? { rel } : {}),
  };
}

/** Heading levels the builder allows, so it cannot emit an invalid tag. */
const HEADING_TAGS = ["h1", "h2", "h3", "h4", "h5", "h6", "p"] as const;
export type HeadingTag = (typeof HEADING_TAGS)[number];

export function headingTag(value: unknown, fallback: HeadingTag = "h2"): HeadingTag {
  return typeof value === "string" && (HEADING_TAGS as readonly string[]).includes(value)
    ? (value as HeadingTag)
    : fallback;
}

/** Turn a YouTube or Vimeo URL into its embeddable form, or null. */
export function embedUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;

  const youtube = raw.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,20})/,
  );
  if (youtube) return `https://www.youtube-nocookie.com/embed/${youtube[1]}`;

  const vimeo = raw.match(/vimeo\.com\/(?:video\/)?(\d{6,12})/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;

  return null;
}
