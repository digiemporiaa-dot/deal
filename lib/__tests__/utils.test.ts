import { describe, it, expect } from "vitest";
import { slugify, formatCurrency, generateBookingNumber, toNumber } from "@/lib/utils";
import { sanitizeWhatsAppNumber, buildWhatsAppLink, packageEnquiryMessage } from "@/lib/whatsapp";

describe("slugify", () => {
  it("creates url-safe slugs", () => {
    expect(slugify("Dubai Dazzle — 5 Days")).toBe("dubai-dazzle-5-days");
    expect(slugify("  Hello   World  ")).toBe("hello-world");
    expect(slugify("Kerala & Backwaters!")).toBe("kerala-backwaters");
  });
});

describe("formatCurrency", () => {
  it("formats INR without decimals", () => {
    const out = formatCurrency(54999, "INR");
    expect(out).toContain("54,999");
  });
});

describe("toNumber", () => {
  it("handles number, string and null", () => {
    expect(toNumber(42)).toBe(42);
    expect(toNumber("42.5")).toBe(42.5);
    expect(toNumber(null)).toBe(0);
  });
});

describe("generateBookingNumber", () => {
  it("matches the VD-YYYYMMDD-#### format", () => {
    expect(generateBookingNumber()).toMatch(/^VD-\d{8}-\d{4}$/);
  });
});

describe("whatsapp helpers", () => {
  it("sanitizes numbers to digits only", () => {
    expect(sanitizeWhatsAppNumber("+91 98765-43210")).toBe("919876543210");
  });
  it("builds a wa.me link with encoded message", () => {
    const link = buildWhatsAppLink("919876543210", packageEnquiryMessage("Dubai Package"));
    expect(link).toContain("https://wa.me/919876543210?text=");
    expect(link).toContain("Dubai%20Package");
  });
});
