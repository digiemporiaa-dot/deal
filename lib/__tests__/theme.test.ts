import { describe, it, expect } from "vitest";
import {
  DEFAULT_THEME,
  FONTS,
  brandScale,
  googleFontHref,
  hoverShade,
  normalizeTheme,
  parseHex,
  themeCss,
} from "@/lib/theme";

describe("parseHex", () => {
  it("reads long and short form", () => {
    expect(parseHex("#1b70f1")).toEqual({ r: 27, g: 112, b: 241 });
    expect(parseHex("#FFF")).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHex("  #000000  ")).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("rejects anything that is not a hex colour", () => {
    for (const bad of [
      "red",
      "rgb(1,2,3)",
      "#12345",
      "#gggggg",
      "",
      null,
      undefined,
      42,
      {},
      "#1b70f1;",
    ]) {
      expect(parseHex(bad)).toBeNull();
    }
  });
});

/**
 * The theme is written into a <style> element, so a value that escapes its
 * declaration could restyle or hide the whole page. These are the payloads
 * that would do it.
 */
describe("CSS injection", () => {
  const payloads = [
    "red;}body{display:none}.x{color:red",
    "#fff;}*{visibility:hidden}",
    "</style><script>alert(1)</script>",
    "url(javascript:alert(1))",
    "expression(alert(1))",
    "#fff\\3b }",
    "var(--x);}html{}",
  ];

  it("never lets a payload reach the output", () => {
    for (const payload of payloads) {
      const css = themeCss({
        brandColor: payload,
        headingColor: payload,
        bodyColor: payload,
        secondaryButtonColor: payload,
        secondaryButtonTextColor: payload,
      });
      expect(css).not.toContain("display:none");
      expect(css).not.toContain("visibility");
      expect(css).not.toContain("script");
      expect(css).not.toContain("javascript");
      expect(css).not.toContain("expression");
      // One rule, one block: nothing broke out of `:root{...}`.
      expect(css.match(/\{/g) ?? []).toHaveLength(1);
      expect(css.match(/\}/g) ?? []).toHaveLength(1);
    }
  });

  it("falls back to the default colour when a value is rejected", () => {
    const css = themeCss({ brandColor: "red;}body{display:none}" });
    expect(css).toContain("--brand-600:27 112 241");
  });

  it("emits only digits and spaces for every colour channel", () => {
    const css = themeCss({ brandColor: "#1b70f1" });
    const colours = css.matchAll(
      /--(?:brand-\d+|site-(?:heading|body|bg|footer-text|button-text|button-2-bg|button-2-hover|button-2-text)):([^;}]+)/g,
    );
    let seen = 0;
    for (const [, value] of colours) {
      expect(value).toMatch(/^\d{1,3} \d{1,3} \d{1,3}$/);
      seen += 1;
    }
    // 11 brand steps + 8 site colours. Asserting the count too, because a
    // regex that quietly matches nothing would pass the loop above.
    expect(seen).toBe(19);
  });

  it("only ever emits a radius it owns", () => {
    const css = themeCss({ buttonRadius: "9999px;}body{display:none}" });
    // "medium" is 8px, exactly what `rounded-lg` was, so an unthemed
    // install looks unchanged.
    expect(css).toContain("--site-button-radius:8px");
  });

  it("only ever emits a font stack it owns", () => {
    const css = themeCss({ bodyFont: '"Evil", x;}body{display:none}' });
    expect(css).toContain(FONTS[DEFAULT_THEME.bodyFont].stack);
    expect(css).not.toContain("Evil");
  });
});

describe("normalizeTheme", () => {
  it("returns defaults for junk", () => {
    for (const junk of [null, undefined, 1, "x", [], { brandColor: 5 }]) {
      expect(normalizeTheme(junk)).toEqual(DEFAULT_THEME);
    }
  });

  it("keeps valid values and normalises their case", () => {
    const t = normalizeTheme({ brandColor: "#AABBCC", buttonRadius: "pill", headingFont: "playfair" });
    expect(t.brandColor).toBe("#aabbcc");
    expect(t.buttonRadius).toBe("pill");
    expect(t.headingFont).toBe("playfair");
  });

  it("replaces an unknown font or radius rather than trusting it", () => {
    const t = normalizeTheme({ headingFont: "comic-sans", buttonRadius: "huge" });
    expect(t.headingFont).toBe(DEFAULT_THEME.headingFont);
    expect(t.buttonRadius).toBe(DEFAULT_THEME.buttonRadius);
  });
});

describe("brandScale", () => {
  it("reproduces the chosen colour exactly at step 600", () => {
    const base = parseHex("#1b70f1")!;
    expect(brandScale(base)["600"]).toEqual(base);
  });

  it("runs light to dark across the ramp", () => {
    const scale = brandScale(parseHex("#1b70f1")!);
    const lum = (s: string) => scale[s]!.r + scale[s]!.g + scale[s]!.b;
    const steps = ["50", "100", "200", "300", "400", "500", "700", "800", "900", "950"];
    for (let i = 1; i < steps.length; i++) {
      expect(lum(steps[i]!)).toBeLessThan(lum(steps[i - 1]!));
    }
  });

  it("gives a near-black pick a usable ramp instead of eleven identical greys", () => {
    const scale = brandScale(parseHex("#050505")!);
    expect(scale["50"]!.r).toBeGreaterThan(200);
    expect(new Set(Object.values(scale).map((c) => `${c.r},${c.g},${c.b}`)).size).toBeGreaterThan(8);
  });

  it("stays in range for every channel", () => {
    for (const hex of ["#ffffff", "#000000", "#ff0000", "#00ff88", "#123456"]) {
      for (const c of Object.values(brandScale(parseHex(hex)!))) {
        for (const v of [c.r, c.g, c.b]) {
          expect(Number.isInteger(v)).toBe(true);
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(255);
        }
      }
    }
  });
});

describe("googleFontHref", () => {
  it("is null when both fonts are local", () => {
    expect(googleFontHref({ headingFont: "georgia", bodyFont: "system" })).toBeNull();
  });

  it("asks for each family once", () => {
    const href = googleFontHref({ headingFont: "inter", bodyFont: "inter" })!;
    expect(href.match(/family=/g)).toHaveLength(1);
    expect(href).toContain("display=swap");
  });

  it("requests both families when they differ", () => {
    const href = googleFontHref({ headingFont: "playfair", bodyFont: "inter" })!;
    expect(href).toContain("Playfair+Display");
    expect(href).toContain("Inter");
  });

  it("cannot be steered at a different host", () => {
    const href = googleFontHref({ headingFont: "https://evil.test/x.css", bodyFont: "inter" })!;
    expect(href.startsWith("https://fonts.googleapis.com/css2?")).toBe(true);
    expect(href).not.toContain("evil");
  });
});


describe("secondary button", () => {
  it("defaults to the slate it was hardcoded to", () => {
    const css = themeCss({});
    expect(css).toContain("--site-button-2-bg:15 23 42");
    expect(css).toContain("--site-button-2-text:255 255 255");
  });

  it("derives its hover rather than reusing the old hardcoded pair", () => {
    // The resting colour is unchanged (slate-900). The hover used to be
    // slate-800 — a second hand-picked Tailwind step, which only exists for
    // that one colour. It is now derived from whatever the admin chose, so it
    // lands near slate-800 rather than exactly on it: 23 35 65 against
    // 30 41 59, a shade bluer and imperceptible in a hover state. That is the
    // cost of the hover working for every colour instead of one.
    const css = themeCss({});
    expect(css).toContain("--site-button-2-hover:23 35 65");
  });

  it("is independent of the brand colour", () => {
    const css = themeCss({ brandColor: "#ff0000", secondaryButtonColor: "#00aa55" });
    expect(css).toContain("--site-button-2-bg:0 170 85");
    expect(css).toContain("--brand-600:255 0 0");
  });

  it("falls back on its own when only it is invalid", () => {
    const css = themeCss({ brandColor: "#00ff00", secondaryButtonColor: "not a colour" });
    expect(css).toContain("--brand-600:0 255 0");
    expect(css).toContain("--site-button-2-bg:15 23 42");
  });
});

describe("hoverShade", () => {
  it("lightens a dark colour and darkens a light one", () => {
    const dark = hoverShade({ r: 15, g: 23, b: 42 });
    expect(dark.r + dark.g + dark.b).toBeGreaterThan(15 + 23 + 42);

    const light = hoverShade({ r: 240, g: 240, b: 240 });
    expect(light.r + light.g + light.b).toBeLessThan(240 * 3);
  });

  it("always moves, even at pure black and pure white", () => {
    const black = hoverShade({ r: 0, g: 0, b: 0 });
    const white = hoverShade({ r: 255, g: 255, b: 255 });
    expect(black).not.toEqual({ r: 0, g: 0, b: 0 });
    expect(white).not.toEqual({ r: 255, g: 255, b: 255 });
  });

  it("stays in range", () => {
    for (const c of ["#000000", "#ffffff", "#0f172a", "#ff0000", "#7f7f7f"]) {
      const out = hoverShade(parseHex(c)!);
      for (const v of [out.r, out.g, out.b]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(255);
      }
    }
  });
});
