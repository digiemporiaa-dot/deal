import { describe, it, expect, beforeEach } from "vitest";
import { sanitizeHtml, stripHtml, excerptFrom } from "@/lib/sanitize";
import { readImageMeta, detectImageFormat, safeFilename } from "@/lib/image-meta";
import { rateLimit, resetRateLimits, limitFor } from "@/lib/rate-limit";
import { normalisePath, normaliseTarget, isRedirectStatusCode, isPermanentStatus } from "@/lib/redirects";
import { redactForLog } from "@/lib/logger";
import { AppError, toSafeError, isAppError } from "@/lib/errors";
import { leadSchema, strongPassword, mediaMetaSchema, leadQuerySchema } from "@/lib/validation";

/* ───────────────────────── XSS ───────────────────────── */

describe("sanitizeHtml — stored XSS", () => {
  it("removes script tags and their contents", () => {
    const out = sanitizeHtml('<p>Hi</p><script>fetch("/steal?c="+document.cookie)</script>');
    expect(out).toContain("<p>Hi</p>");
    expect(out.toLowerCase()).not.toContain("script");
    expect(out).not.toContain("document.cookie");
  });

  it("strips every event handler", () => {
    const out = sanitizeHtml('<img src="/a.png" onerror="alert(1)" onload="alert(2)">');
    expect(out).not.toContain("onerror");
    expect(out).not.toContain("onload");
    expect(out).not.toContain("alert");
    expect(out).toContain("/a.png");
  });

  it("rejects javascript: and data: URLs but keeps real links", () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).not.toContain("javascript");
    expect(sanitizeHtml('<a href="java\tscript:alert(1)">x</a>')).not.toContain("script:");
    expect(sanitizeHtml('<img src="data:text/html;base64,PHNjcmlwdD4=">')).not.toContain("data:text");
    // An SVG data URI can carry script, so it is refused too.
    expect(sanitizeHtml('<img src="data:image/svg+xml;base64,PHN2Zz4=">')).not.toContain("svg+xml");

    const safe = sanitizeHtml('<a href="https://example.com">ok</a>');
    expect(safe).toContain('href="https://example.com"');
  });

  it("drops iframes, objects, forms and inline SVG", () => {
    for (const payload of [
      '<iframe src="https://evil.test"></iframe>',
      "<object data=x></object>",
      '<form action="/pay"><input name="a"></form>',
      "<svg><script>alert(1)</script></svg>",
    ]) {
      const out = sanitizeHtml(payload);
      expect(out).not.toMatch(/iframe|object|<form|svg|script/i);
    }
  });

  it("keeps ordinary formatting intact", () => {
    const input = "<h2>Day 1</h2><p><strong>Arrive</strong> in <em>Bali</em></p><ul><li>Transfer</li></ul>";
    const out = sanitizeHtml(input);
    expect(out).toContain("<h2>Day 1</h2>");
    expect(out).toContain("<strong>");
    expect(out).toContain("<li>Transfer</li>");
  });

  it("adds rel=noopener to links opening a new tab", () => {
    const out = sanitizeHtml('<a href="https://example.com" target="_blank">x</a>');
    expect(out).toContain("noopener");
  });

  it("strips style attributes, which can carry expressions", () => {
    expect(sanitizeHtml('<p style="background:url(javascript:alert(1))">x</p>')).not.toContain("style");
  });
});

describe("stripHtml / excerptFrom", () => {
  it("returns readable plain text", () => {
    expect(stripHtml("<p>Hello <strong>world</strong></p>")).toBe("Hello world");
    expect(stripHtml("<script>bad()</script><p>ok</p>")).toBe("ok");
  });

  it("trims an excerpt on a word boundary", () => {
    const text = excerptFrom("<p>" + "word ".repeat(60) + "</p>", 40);
    expect(text.length).toBeLessThanOrEqual(41);
    expect(text.endsWith("…")).toBe(true);
  });
});

/* ────────────────── Malicious uploads ────────────────── */

// Minimal valid headers for each format.
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from([0, 0, 0, 13]),
  Buffer.from("IHDR"),
  (() => {
    const b = Buffer.alloc(8);
    b.writeUInt32BE(1200, 0);
    b.writeUInt32BE(630, 4);
    return b;
  })(),
]);

const GIF = (() => {
  const b = Buffer.alloc(16);
  b.write("GIF89a", 0, "ascii");
  b.writeUInt16LE(320, 6);
  b.writeUInt16LE(240, 8);
  return b;
})();

describe("upload validation", () => {
  it("reads the format and dimensions from the bytes", () => {
    const png = readImageMeta(PNG);
    expect(png?.format).toBe("png");
    expect(png?.mimeType).toBe("image/png");
    expect(png?.width).toBe(1200);
    expect(png?.height).toBe(630);

    const gif = readImageMeta(GIF);
    expect(gif?.format).toBe("gif");
    expect(gif?.width).toBe(320);
  });

  it("rejects an executable dressed up as an image", () => {
    // ELF header renamed "holiday.jpg" with Content-Type: image/jpeg.
    const elf = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00, 0, 0, 0, 0]);
    expect(detectImageFormat(elf)).toBeNull();
    expect(readImageMeta(elf)).toBeNull();
  });

  it("rejects PHP, HTML and SVG payloads", () => {
    for (const payload of [
      '<?php system($_GET["c"]); ?>',
      "<html><script>alert(1)</script></html>",
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    ]) {
      expect(readImageMeta(Buffer.from(payload))).toBeNull();
    }
  });

  it("neutralises path traversal and double extensions in file names", () => {
    expect(safeFilename("../../../etc/passwd", "png")).not.toContain("..");
    expect(safeFilename("../../../etc/passwd", "png")).not.toContain("/");
    expect(safeFilename("../../../etc/passwd", "png")).toMatch(/^passwd-[a-z0-9]+\.png$/);

    // The extension always comes from the detected format, never the name.
    const shell = safeFilename("shell.php.jpg", "jpg");
    expect(shell.endsWith(".jpg")).toBe(true);
    expect(shell).not.toContain(".php");

    // A name made entirely of junk still produces a usable file name.
    expect(safeFilename("...", "webp")).toMatch(/^image-[a-z0-9]+\.webp$/);
  });

  it("produces a different name for each upload of the same file", () => {
    const a = safeFilename("beach.jpg", "jpg");
    const b = safeFilename("beach.jpg", "jpg");
    expect(a).not.toBe(b);
  });
});

/* ───────────────────── Rate limiting ──────────────────── */

describe("rate limiting", () => {
  beforeEach(() => resetRateLimits());

  it("allows up to the limit and then refuses", () => {
    for (let i = 0; i < 3; i += 1) {
      expect(rateLimit("test:key", 3, 60_000).ok).toBe(true);
    }
    const blocked = rateLimit("test:key", 3, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("counts each key separately, so one IP cannot lock out another", () => {
    for (let i = 0; i < 3; i += 1) rateLimit("ip:1.1.1.1", 3, 60_000);
    expect(rateLimit("ip:1.1.1.1", 3, 60_000).ok).toBe(false);
    expect(rateLimit("ip:2.2.2.2", 3, 60_000).ok).toBe(true);
  });

  it("namespaces the named limits, so login attempts do not spend the upload budget", () => {
    const key = "1.2.3.4";
    for (let i = 0; i < 8; i += 1) limitFor("login", key);
    expect(limitFor("login", key).ok).toBe(false);
    expect(limitFor("upload", key).ok).toBe(true);
  });

  it("starts a fresh window once the old one expires", () => {
    expect(rateLimit("short", 1, 1).ok).toBe(true);
    expect(rateLimit("short", 1, 1).ok).toBe(false);
    // A window of 1ms has already passed by the next tick.
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(rateLimit("short", 1, 1).ok).toBe(true);
        resolve();
      }, 5);
    });
  });
});

/* ───────────────── Redirect validation ────────────────── */

describe("redirect validation", () => {
  it("normalises whatever an admin pastes into a path", () => {
    expect(normalisePath("https://vacationdeal.test/old-page/")).toBe("/old-page");
    expect(normalisePath("old-page")).toBe("/old-page");
    expect(normalisePath("//old//page//")).toBe("/old/page");
    expect(normalisePath("/page#section")).toBe("/page");
    expect(normalisePath("  /spaced  ")).toBe("/spaced");
    expect(normalisePath("")).toBe("");
  });

  it("keeps absolute targets and normalises relative ones", () => {
    expect(normaliseTarget("https://partner.example/deal")).toBe("https://partner.example/deal");
    expect(normaliseTarget("new-page")).toBe("/new-page");
  });

  it("accepts only the four redirect codes", () => {
    for (const code of [301, 302, 307, 308]) expect(isRedirectStatusCode(code)).toBe(true);
    for (const code of [200, 303, 404, 500, 0, -1]) expect(isRedirectStatusCode(code)).toBe(false);
  });

  it("knows which codes are permanent", () => {
    expect(isPermanentStatus(301)).toBe(true);
    expect(isPermanentStatus(308)).toBe(true);
    expect(isPermanentStatus(302)).toBe(false);
    expect(isPermanentStatus(307)).toBe(false);
  });
});

/* ────────────────── Errors and logging ────────────────── */

describe("safe errors", () => {
  it("passes an intentional message through", () => {
    const safe = toSafeError(new AppError("FORBIDDEN"), "test");
    expect(safe.status).toBe(403);
    expect(safe.message).toBe("You do not have permission to do that.");
  });

  it("never leaks an unexpected error's details", () => {
    const leaky = new Error(
      'Invalid `prisma.user.findUnique()` invocation in /var/app/lib/db.ts:12 — password="hunter2"',
    );
    const safe = toSafeError(leaky, "test");
    expect(safe.status).toBe(500);
    expect(safe.message).not.toContain("prisma");
    expect(safe.message).not.toContain("hunter2");
    expect(safe.message).not.toContain("/var/app");
  });

  it("identifies its own error type", () => {
    expect(isAppError(new AppError("NOT_FOUND"))).toBe(true);
    expect(isAppError(new Error("x"))).toBe(false);
  });
});

describe("log redaction", () => {
  it("removes secrets from anything logged", () => {
    const redacted = redactForLog({
      email: "a@b.test",
      password: "hunter2",
      passwordHash: "$2a$12$abc",
      razorpay_signature: "deadbeef",
      nested: { token: "abc123", keep: "visible" },
    }) as Record<string, unknown>;

    expect(redacted.email).toBe("a@b.test");
    expect(redacted.password).toBe("[redacted]");
    expect(redacted.passwordHash).toBe("[redacted]");
    expect(redacted.razorpay_signature).toBe("[redacted]");
    expect((redacted.nested as Record<string, unknown>).token).toBe("[redacted]");
    expect((redacted.nested as Record<string, unknown>).keep).toBe("visible");
  });
});

/* ──────────────────── Input validation ─────────────────── */

describe("input validation", () => {
  it("accepts a normal enquiry", () => {
    const result = leadSchema.safeParse({
      name: "Deepak Nair",
      phone: "+91 98765 43210",
      email: "deepak@example.com",
      destination: "Bali",
    });
    expect(result.success).toBe(true);
  });

  it("rejects junk without throwing", () => {
    expect(leadSchema.safeParse({ name: "D", phone: "1" }).success).toBe(false);
    expect(leadSchema.safeParse({}).success).toBe(false);
    expect(leadSchema.safeParse({ name: "Ok Name", phone: "98765 43210", email: "not-an-email" }).success).toBe(false);
  });

  it("treats SQL-shaped input as ordinary text, not as a failure", () => {
    // Prisma parameterises every query, so this is just a name — the point is
    // that it neither crashes nor is silently mangled.
    const result = leadSchema.safeParse({
      name: "Robert'); DROP TABLE Lead;--",
      phone: "9876543210",
      message: "1 OR 1=1; --",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toContain("DROP TABLE");
  });

  it("caps oversized free-text fields", () => {
    const tooLong = leadSchema.safeParse({
      name: "Valid Name",
      phone: "9876543210",
      message: "x".repeat(5000),
    });
    expect(tooLong.success).toBe(false);
  });

  it("requires a strong admin password", () => {
    expect(strongPassword.safeParse("short1A").success).toBe(false);
    expect(strongPassword.safeParse("alllowercase1").success).toBe(false);
    expect(strongPassword.safeParse("ALLUPPERCASE1").success).toBe(false);
    expect(strongPassword.safeParse("NoDigitsHere!").success).toBe(false);
    expect(strongPassword.safeParse("GoodPassw0rd").success).toBe(true);
  });

  it("refuses a media folder that could escape the upload directory", () => {
    expect(mediaMetaSchema.safeParse({ folder: "../../etc" }).success).toBe(false);
    expect(mediaMetaSchema.safeParse({ folder: "packages/../.." }).success).toBe(false);
    expect(mediaMetaSchema.safeParse({ folder: "packages" }).success).toBe(true);
  });

  it("refuses list query parameters outside a sane range", () => {
    // The page rejects the whole query and falls back to defaults, so a
    // crafted URL can never ask Prisma for the entire table.
    expect(leadQuerySchema.safeParse({ page: "999999999" }).success).toBe(false);
    expect(leadQuerySchema.safeParse({ perPage: "100000" }).success).toBe(false);
    expect(leadQuerySchema.safeParse({ page: "-1" }).success).toBe(false);
    expect(leadQuerySchema.safeParse({ from: "not-a-date" }).success).toBe(false);
    expect(leadQuerySchema.safeParse({ sort: "; DROP TABLE" }).success).toBe(false);

    const sane = leadQuerySchema.parse({ page: "2", perPage: "50" });
    expect(sane.page).toBe(2);
    expect(sane.perPage).toBe(50);
    // Defaults apply when nothing is supplied.
    expect(leadQuerySchema.parse({}).perPage).toBe(25);
  });
});
