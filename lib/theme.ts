/**
 * Site appearance.
 *
 * One place an admin controls how the public site looks: brand colour, text
 * colours, fonts, button shape, logo. The values live in the `theme` block of
 * the site settings JSON, so changing them needs no migration and no deploy.
 *
 * These values end up inside a `<style>` element, which makes them a CSS
 * injection risk: a "colour" of `red;}body{display:none}` would otherwise
 * rewrite the page. The defence here is not escaping but reconstruction —
 * **nothing an admin types is ever copied into the output.** A colour is
 * parsed into three numbers and re-emitted from those numbers; a font is a
 * key looked up in the table below and the stack comes from that table; a
 * radius is an enum mapped to a literal this file owns. Anything that fails
 * to parse falls back to the default. A string that is not a colour cannot
 * survive being turned into an integer and printed back out.
 */

export type ButtonRadius = "none" | "small" | "medium" | "large" | "pill";

export type FontKey =
  | "system"
  | "inter"
  | "poppins"
  | "montserrat"
  | "lato"
  | "playfair"
  | "merriweather"
  | "dmSerif"
  | "georgia";

type FontDef = {
  label: string;
  /** The stack written into CSS. Owned by this file, never by the admin. */
  stack: string;
  /** Google Fonts family name plus weights, when it needs loading. */
  google?: string;
  kind: "sans" | "serif";
};

export const FONTS: Record<FontKey, FontDef> = {
  system: {
    label: "System default",
    stack: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    kind: "sans",
  },
  inter: { label: "Inter", stack: '"Inter", system-ui, sans-serif', google: "Inter:wght@400;500;600;700", kind: "sans" },
  poppins: { label: "Poppins", stack: '"Poppins", system-ui, sans-serif', google: "Poppins:wght@400;500;600;700", kind: "sans" },
  montserrat: { label: "Montserrat", stack: '"Montserrat", system-ui, sans-serif', google: "Montserrat:wght@400;500;600;700", kind: "sans" },
  lato: { label: "Lato", stack: '"Lato", system-ui, sans-serif', google: "Lato:wght@400;700", kind: "sans" },
  playfair: { label: "Playfair Display", stack: '"Playfair Display", Georgia, serif', google: "Playfair+Display:wght@400;600;700", kind: "serif" },
  merriweather: { label: "Merriweather", stack: '"Merriweather", Georgia, serif', google: "Merriweather:wght@400;700", kind: "serif" },
  dmSerif: { label: "DM Serif Display", stack: '"DM Serif Display", Georgia, serif', google: "DM+Serif+Display", kind: "serif" },
  georgia: { label: "Georgia", stack: 'Georgia, "Times New Roman", serif', kind: "serif" },
};

export const FONT_KEYS = Object.keys(FONTS) as FontKey[];

const RADII: Record<ButtonRadius, string> = {
  none: "0px",
  small: "6px",
  medium: "8px",
  large: "16px",
  pill: "9999px",
};

export const RADIUS_KEYS = Object.keys(RADII) as ButtonRadius[];

export type ThemeSettings = {
  brandColor: string;
  headingColor: string;
  bodyColor: string;
  pageBackground: string;
  headerBackground: string;
  footerBackground: string;
  footerText: string;
  buttonTextColor: string;
  /** The second button style — "Secondary" in the builder's Button element. */
  secondaryButtonColor: string;
  secondaryButtonTextColor: string;
  buttonRadius: ButtonRadius;
  headingFont: FontKey;
  bodyFont: FontKey;
};

export const DEFAULT_THEME: ThemeSettings = {
  brandColor: "#1b70f1",
  headingColor: "#0f172a",
  bodyColor: "#334155",
  pageBackground: "#ffffff",
  headerBackground: "#ffffff",
  footerBackground: "#f8fafc",
  footerText: "#334155",
  buttonTextColor: "#ffffff",
  secondaryButtonColor: "#0f172a",
  secondaryButtonTextColor: "#ffffff",
  buttonRadius: "medium",
  headingFont: "georgia",
  bodyFont: "system",
};

/* ───────────────────────────── colour ───────────────────────────── */

export type Rgb = { r: number; g: number; b: number };

/** Parse `#rgb` or `#rrggbb`. Anything else returns null — including a value
    carrying CSS of its own, which is the point. */
export function parseHex(input: unknown): Rgb | null {
  if (typeof input !== "string") return null;
  const value = input.trim();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(value);
  if (short) {
    return {
      r: parseInt(short[1]! + short[1]!, 16),
      g: parseInt(short[2]! + short[2]!, 16),
      b: parseInt(short[3]! + short[3]!, 16),
    };
  }
  const long = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value);
  if (!long) return null;
  return {
    r: parseInt(long[1]!, 16),
    g: parseInt(long[2]!, 16),
    b: parseInt(long[3]!, 16),
  };
}

/** `"r g b"` — the channel form Tailwind needs for `<alpha-value>`. */
export function channels(rgb: Rgb): string {
  return `${rgb.r} ${rgb.g} ${rgb.b}`;
}

function rgbToHsl({ r, g, b }: Rgb): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return {
    r: Math.round(channel(h + 1 / 3) * 255),
    g: Math.round(channel(h) * 255),
    b: Math.round(channel(h - 1 / 3) * 255),
  };
}

/**
 * Lightness targets for each step of the scale.
 *
 * An admin picks one colour, not eleven. That colour becomes step 600 — the
 * one the buttons and links use — and the rest of the ramp is derived from
 * its hue and saturation. Asking someone to choose eleven harmonious shades
 * is how brand palettes end up muddy.
 */
const SCALE: Record<string, number> = {
  "50": 0.97,
  "100": 0.94,
  "200": 0.86,
  "300": 0.77,
  "400": 0.66,
  "500": 0.58,
  "600": 0.5,
  "700": 0.42,
  "800": 0.34,
  "900": 0.28,
  "950": 0.18,
};

/**
 * The colour a solid button becomes on hover.
 *
 * Always a step *away* from where the colour already is: a dark button
 * lightens, a light one darkens. Darkening unconditionally would make a
 * near-black button look broken on hover — nothing visibly happens — which is
 * how the hardcoded slate-900/slate-800 pair worked before this was derived.
 */
export function hoverShade(base: Rgb): Rgb {
  const { h, s, l } = rgbToHsl(base);
  const next = l < 0.5 ? Math.min(1, l + 0.06) : Math.max(0, l - 0.06);
  return hslToRgb(h, s, next);
}

export type BrandScale = Record<string, Rgb>;

export function brandScale(base: Rgb): BrandScale {
  const { h, s } = rgbToHsl(base);
  // A very pale or very dark pick still needs a usable ramp, so saturation is
  // floored — otherwise picking near-black gives eleven identical greys.
  const sat = Math.min(1, Math.max(0.12, s));
  const out: BrandScale = {};
  for (const [step, l] of Object.entries(SCALE)) {
    // Step 600 is the colour the admin actually chose; reproducing it exactly
    // matters more than sitting on the computed ramp.
    out[step] = step === "600" ? base : hslToRgb(h, sat, l);
  }
  return out;
}

/* ─────────────────────────── validation ─────────────────────────── */

function colorOr(input: unknown, fallback: string): string {
  const parsed = parseHex(input);
  if (!parsed) return fallback;
  // Re-emitted from the parsed numbers, never echoed back as typed.
  const hex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${hex(parsed.r)}${hex(parsed.g)}${hex(parsed.b)}`;
}

function fontOr(input: unknown, fallback: FontKey): FontKey {
  return typeof input === "string" && input in FONTS ? (input as FontKey) : fallback;
}

/** Coerce anything into a valid theme. Never throws; unknown input becomes
    the default, which is what keeps a corrupt settings row from breaking the
    public site. */
export function normalizeTheme(input: unknown): ThemeSettings {
  const t = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  return {
    brandColor: colorOr(t.brandColor, DEFAULT_THEME.brandColor),
    headingColor: colorOr(t.headingColor, DEFAULT_THEME.headingColor),
    bodyColor: colorOr(t.bodyColor, DEFAULT_THEME.bodyColor),
    pageBackground: colorOr(t.pageBackground, DEFAULT_THEME.pageBackground),
    headerBackground: colorOr(t.headerBackground, DEFAULT_THEME.headerBackground),
    footerBackground: colorOr(t.footerBackground, DEFAULT_THEME.footerBackground),
    footerText: colorOr(t.footerText, DEFAULT_THEME.footerText),
    buttonTextColor: colorOr(t.buttonTextColor, DEFAULT_THEME.buttonTextColor),
    secondaryButtonColor: colorOr(t.secondaryButtonColor, DEFAULT_THEME.secondaryButtonColor),
    secondaryButtonTextColor: colorOr(
      t.secondaryButtonTextColor,
      DEFAULT_THEME.secondaryButtonTextColor,
    ),
    buttonRadius:
      typeof t.buttonRadius === "string" && t.buttonRadius in RADII
        ? (t.buttonRadius as ButtonRadius)
        : DEFAULT_THEME.buttonRadius,
    headingFont: fontOr(t.headingFont, DEFAULT_THEME.headingFont),
    bodyFont: fontOr(t.bodyFont, DEFAULT_THEME.bodyFont),
  };
}

/* ──────────────────────────── output ────────────────────────────── */

/**
 * The custom properties the public site reads.
 *
 * Every value here is either a number this file computed or a literal from
 * one of its own tables, so there is no path from typed text to CSS.
 */
export function themeCss(input: unknown): string {
  const theme = normalizeTheme(input);
  const base = parseHex(theme.brandColor) ?? parseHex(DEFAULT_THEME.brandColor)!;
  const scale = brandScale(base);

  const decl: string[] = [];
  for (const [step, rgb] of Object.entries(scale)) {
    decl.push(`--brand-${step}:${channels(rgb)}`);
  }

  const solid = (value: string, fallback: string) =>
    channels(parseHex(value) ?? parseHex(fallback)!);

  decl.push(`--site-heading:${solid(theme.headingColor, DEFAULT_THEME.headingColor)}`);
  decl.push(`--site-body:${solid(theme.bodyColor, DEFAULT_THEME.bodyColor)}`);
  decl.push(`--site-bg:${solid(theme.pageBackground, DEFAULT_THEME.pageBackground)}`);
  decl.push(`--site-header-bg:${solid(theme.headerBackground, DEFAULT_THEME.headerBackground)}`);
  decl.push(`--site-footer-bg:${solid(theme.footerBackground, DEFAULT_THEME.footerBackground)}`);
  decl.push(`--site-footer-text:${solid(theme.footerText, DEFAULT_THEME.footerText)}`);
  decl.push(`--site-button-text:${solid(theme.buttonTextColor, DEFAULT_THEME.buttonTextColor)}`);

  const secondary =
    parseHex(theme.secondaryButtonColor) ?? parseHex(DEFAULT_THEME.secondaryButtonColor)!;
  decl.push(`--site-button-2-bg:${channels(secondary)}`);
  decl.push(`--site-button-2-hover:${channels(hoverShade(secondary))}`);
  decl.push(
    `--site-button-2-text:${solid(theme.secondaryButtonTextColor, DEFAULT_THEME.secondaryButtonTextColor)}`,
  );
  decl.push(`--site-button-radius:${RADII[theme.buttonRadius]}`);
  decl.push(`--font-sans:${FONTS[theme.bodyFont].stack}`);
  decl.push(`--font-display:${FONTS[theme.headingFont].stack}`);

  return `:root{${decl.join(";")}}`;
}

/** The Google Fonts stylesheet to load, or null when both fonts are local. */
export function googleFontHref(input: unknown): string | null {
  const theme = normalizeTheme(input);
  const families = new Set<string>();
  for (const key of [theme.headingFont, theme.bodyFont]) {
    const g = FONTS[key].google;
    if (g) families.add(g);
  }
  if (families.size === 0) return null;
  const query = [...families].map((f) => `family=${f}`).join("&");
  return `https://fonts.googleapis.com/css2?${query}&display=swap`;
}
