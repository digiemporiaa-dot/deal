import type { CSSProperties } from "react";
import type { Breakpoint, NodeSettings, Spacing, StyleSettings } from "@/lib/builder/schema";

/**
 * Turns builder settings into CSS.
 *
 * Two outputs, because the editor and the public site need different things:
 *
 *  • `resolveStyle` + `toCssProperties` — a flat style object for one
 *    breakpoint, used by the canvas, where the device toggle decides what to
 *    show rather than the real viewport width.
 *
 *  • `nodeCss` — a real stylesheet with media queries, emitted once per page
 *    on the server. No runtime CSS-in-JS, nothing to hydrate.
 *
 * Tablet and mobile inherit from the breakpoint above, so an unset value is
 * an inherited value rather than a reset.
 */

/** Widths below which each breakpoint applies. */
export const BREAKPOINT_MAX_WIDTH: Record<Exclude<Breakpoint, "desktop">, number> = {
  tablet: 1024,
  mobile: 640,
};

/**
 * Strip anything that could terminate a declaration or a rule.
 *
 * Style values are typed by an admin. Without this, a colour of
 * `red; } body { display: none } .x {` would escape its own rule and restyle
 * the whole page — a defacement primitive, not just a broken card.
 */
export function safeCssValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (!text.trim()) return "";

  return text
    .replace(/[{};<>]/g, "")
    .replace(/\/\*/g, "")
    .replace(/\*\//g, "")
    // `expression()` and `javascript:` are legacy script vectors in CSS.
    .replace(/expression\s*\(/gi, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/behaviou?r\s*:/gi, "")
    .trim()
    .slice(0, 300);
}

/** A url() value — only http(s) and site-relative paths are allowed. */
function safeCssUrl(value: unknown): string {
  const raw = safeCssValue(value).replace(/["'()]/g, "");
  if (!raw) return "";
  if (!/^(https?:\/\/|\/)/i.test(raw)) return "";
  return raw;
}

function spacingToCss(spacing: Spacing | undefined): string | undefined {
  if (!spacing) return undefined;
  const parts = [spacing.top, spacing.right, spacing.bottom, spacing.left].map(
    (value) => safeCssValue(value) || "0",
  );
  return parts.every((part) => part === "0") ? undefined : parts.join(" ");
}

/**
 * Merge the breakpoint cascade: desktop is the base, tablet overrides it,
 * mobile overrides both.
 */
export function resolveStyle(
  settings: NodeSettings | undefined,
  breakpoint: Breakpoint,
): StyleSettings {
  const desktop = settings?.desktop ?? {};
  if (breakpoint === "desktop") return desktop;

  const tablet = { ...desktop, ...(settings?.tablet ?? {}) };
  if (breakpoint === "tablet") return tablet;

  return { ...tablet, ...(settings?.mobile ?? {}) };
}

/** Is this node hidden on the given device? */
export function isHiddenAt(settings: NodeSettings | undefined, breakpoint: Breakpoint): boolean {
  return Boolean(settings?.hidden?.[breakpoint]);
}

/** Hidden on every breakpoint — the renderer can skip it entirely. */
export function isHiddenEverywhere(settings: NodeSettings | undefined): boolean {
  const hidden = settings?.hidden;
  return Boolean(hidden?.desktop && hidden?.tablet && hidden?.mobile);
}

/** Style object for inline application in the editor canvas. */
export function toCssProperties(style: StyleSettings): CSSProperties {
  const css: Record<string, string | number> = {};

  const set = (property: string, value: unknown) => {
    const safe = safeCssValue(value);
    if (safe) css[property] = safe;
  };

  set("fontSize", style.fontSize);
  set("fontWeight", style.fontWeight);
  set("lineHeight", style.lineHeight);
  set("letterSpacing", style.letterSpacing);
  set("textAlign", style.textAlign);
  set("textTransform", style.textTransform);
  set("color", style.color);

  set("background", style.background);
  set("backgroundSize", style.backgroundSize);
  set("backgroundPosition", style.backgroundPosition);
  set("backgroundRepeat", style.backgroundRepeat);

  const image = safeCssUrl(style.backgroundImage);
  if (image) css.backgroundImage = `url("${image}")`;

  const padding = spacingToCss(style.padding);
  if (padding) css.padding = padding;
  const margin = spacingToCss(style.margin);
  if (margin) css.margin = margin;

  set("width", style.width);
  set("maxWidth", style.maxWidth);
  set("minHeight", style.minHeight);

  set("display", style.display);
  set("flexDirection", style.flexDirection);
  set("alignItems", style.alignItems);
  set("justifyContent", style.justifyContent);
  set("flexWrap", style.flexWrap);
  set("gap", style.gap);

  if (style.columns && style.display === "grid") {
    css.gridTemplateColumns = `repeat(${Math.max(1, Math.min(6, style.columns))}, minmax(0, 1fr))`;
  }

  set("borderWidth", style.borderWidth);
  set("borderStyle", style.borderStyle);
  set("borderColor", style.borderColor);
  set("borderRadius", style.borderRadius);
  set("boxShadow", style.boxShadow);

  if (typeof style.opacity === "number") css.opacity = style.opacity;

  return css as CSSProperties;
}

/** Convert a camelCase property to its CSS spelling. */
function kebab(property: string): string {
  return property.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
}

function declarations(style: StyleSettings): string {
  const css = toCssProperties(style) as Record<string, string | number>;
  return Object.entries(css)
    .map(([property, value]) => `${kebab(property)}:${value}`)
    .join(";");
}

/**
 * Only the properties actually overridden at this breakpoint, so a media
 * query does not restate the whole desktop rule.
 */
function overrides(settings: NodeSettings | undefined, breakpoint: "tablet" | "mobile"): string {
  const own = settings?.[breakpoint];
  if (!own || Object.keys(own).length === 0) return "";
  return declarations(own);
}

export type NodeCss = { selector: string; css: string };

/**
 * The stylesheet for one node, including its media queries and any
 * per-device visibility rules.
 */
export function nodeCss(nodeId: string, settings: NodeSettings | undefined): string {
  if (!settings) return "";

  // The id comes from validated document JSON, but this string ends up inside
  // a selector, so it is re-checked here rather than trusted.
  if (!/^[a-zA-Z0-9_-]+$/.test(nodeId)) return "";
  const selector = `[data-b="${nodeId}"]`;

  const blocks: string[] = [];

  const base = declarations(settings.desktop ?? {});
  if (base) blocks.push(`${selector}{${base}}`);

  const tablet = overrides(settings, "tablet");
  if (tablet) {
    blocks.push(`@media (max-width:${BREAKPOINT_MAX_WIDTH.tablet}px){${selector}{${tablet}}}`);
  }

  const mobile = overrides(settings, "mobile");
  if (mobile) {
    blocks.push(`@media (max-width:${BREAKPOINT_MAX_WIDTH.mobile}px){${selector}{${mobile}}}`);
  }

  // Visibility. Desktop means "above the tablet breakpoint", so the three
  // rules together cover every width exactly once.
  const hidden = settings.hidden ?? {};
  if (hidden.desktop) {
    blocks.push(
      `@media (min-width:${BREAKPOINT_MAX_WIDTH.tablet + 1}px){${selector}{display:none}}`,
    );
  }
  if (hidden.tablet) {
    blocks.push(
      `@media (min-width:${BREAKPOINT_MAX_WIDTH.mobile + 1}px) and (max-width:${BREAKPOINT_MAX_WIDTH.tablet}px){${selector}{display:none}}`,
    );
  }
  if (hidden.mobile) {
    blocks.push(`@media (max-width:${BREAKPOINT_MAX_WIDTH.mobile}px){${selector}{display:none}}`);
  }

  return blocks.join("");
}

/** A safe class attribute from the advanced settings. */
export function customClassName(settings: NodeSettings | undefined): string {
  const value = settings?.advanced?.customClass;
  if (!value) return "";
  return value.replace(/[^a-zA-Z0-9_\- ]/g, "").slice(0, 200);
}

/** A safe anchor id from the advanced settings. */
export function customElementId(settings: NodeSettings | undefined): string | undefined {
  const value = settings?.advanced?.customId;
  if (!value) return undefined;
  const cleaned = value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 60);
  return cleaned || undefined;
}
