import { describe, it, expect } from "vitest";
import {
  LEAD_STATUSES,
  classifySource,
  attributionFromUrl,
  hasAttribution,
  parseAttribution,
  serializeAttribution,
  conversionRate,
  leadStatusLabel,
  leadSourceLabel,
  EMPTY_ATTRIBUTION,
} from "@/lib/crm";

describe("lead pipeline", () => {
  it("keeps CONVERTED as the won state so existing rows stay valid", () => {
    expect(LEAD_STATUSES).toContain("CONVERTED");
    expect(leadStatusLabel("CONVERTED")).toBe("Won");
  });

  it("includes the statuses that existed before the upgrade", () => {
    for (const status of ["NEW", "CONTACTED", "FOLLOW_UP", "QUALIFIED", "CONVERTED", "LOST"]) {
      expect(LEAD_STATUSES as readonly string[]).toContain(status);
    }
  });

  it("falls back to a readable label for an unknown status", () => {
    expect(leadStatusLabel("SOME_OLD_STATUS")).toBe("SOME OLD STATUS");
  });
});

describe("source classification", () => {
  it("trusts a click id over anything else", () => {
    expect(classifySource({ gclid: "abc", utmSource: "newsletter" })).toBe("GOOGLE_ADS");
    expect(classifySource({ fbclid: "abc", utmSource: "newsletter" })).toBe("META_ADS");
  });

  it("reads paid traffic from the utm pair", () => {
    expect(classifySource({ utmSource: "google", utmMedium: "cpc" })).toBe("GOOGLE_ADS");
    expect(classifySource({ utmSource: "facebook", utmMedium: "paid_social" })).toBe("META_ADS");
    expect(classifySource({ utmSource: "instagram", utmMedium: "cpc" })).toBe("META_ADS");
  });

  it("falls back to the referrer when there is no tagging", () => {
    expect(classifySource({ referrer: "https://www.google.com/search?q=bali" })).toBe("ORGANIC");
    expect(classifySource({ referrer: "https://wa.me/919876543210" })).toBe("WHATSAPP");
    expect(classifySource({ referrer: "https://someblog.test/post" })).toBe("REFERRAL");
  });

  it("calls a visit with nothing at all direct", () => {
    expect(classifySource({})).toBe("DIRECT");
    expect(classifySource({ referrer: "" })).toBe("DIRECT");
  });
});

describe("attribution capture", () => {
  it("reads every parameter from the landing URL", () => {
    const url = new URL(
      "https://vacationdeal.test/packages/bali?utm_source=google&utm_medium=cpc&utm_campaign=bali-may&utm_term=bali+tour&utm_content=ad1&gclid=XYZ",
    );
    const attribution = attributionFromUrl(url, "https://www.google.com/");

    expect(attribution.source).toBe("GOOGLE_ADS");
    expect(attribution.medium).toBe("cpc");
    expect(attribution.campaign).toBe("bali-may");
    expect(attribution.term).toBe("bali tour");
    expect(attribution.content).toBe("ad1");
    expect(attribution.gclid).toBe("XYZ");
    expect(attribution.landingPage).toContain("/packages/bali");
    expect(hasAttribution(attribution)).toBe(true);
  });

  it("does not treat an internal link as an acquisition source", () => {
    const url = new URL("https://vacationdeal.test/packages");
    const attribution = attributionFromUrl(url, "https://vacationdeal.test/");
    expect(attribution.referrer).toBeNull();
    expect(attribution.source).toBe("DIRECT");
    expect(hasAttribution(attribution)).toBe(false);
  });

  it("truncates oversized parameters rather than storing them", () => {
    const url = new URL(`https://vacationdeal.test/?utm_campaign=${"x".repeat(2000)}`);
    const attribution = attributionFromUrl(url, null);
    expect(attribution.campaign!.length).toBeLessThanOrEqual(200);
  });

  it("survives a round trip through the cookie", () => {
    const url = new URL("https://vacationdeal.test/?utm_source=facebook&utm_medium=paid_social&fbclid=A1");
    const original = attributionFromUrl(url, null);
    const restored = parseAttribution(serializeAttribution(original));

    expect(restored).not.toBeNull();
    expect(restored!.source).toBe("META_ADS");
    expect(restored!.fbclid).toBe("A1");
  });

  it("ignores a tampered or corrupt cookie instead of trusting it", () => {
    expect(parseAttribution("not json")).toBeNull();
    expect(parseAttribution(null)).toBeNull();
    expect(parseAttribution("")).toBeNull();

    // An unknown channel is normalised rather than stored as given.
    const tampered = parseAttribution(JSON.stringify({ source: "'; DROP TABLE Lead;--" }));
    expect(tampered?.source).toBe("DIRECT");
  });

  it("starts from a usable empty value", () => {
    expect(EMPTY_ATTRIBUTION.source).toBe("DIRECT");
    expect(hasAttribution(EMPTY_ATTRIBUTION)).toBe(false);
  });
});

describe("conversion rate", () => {
  it("is bookings over leads, as a percentage", () => {
    expect(conversionRate(100, 25)).toBe(25);
    expect(conversionRate(80, 10)).toBe(12.5);
  });

  it("returns zero rather than dividing by zero", () => {
    expect(conversionRate(0, 0)).toBe(0);
    expect(conversionRate(0, 5)).toBe(0);
    expect(conversionRate(-1, 5)).toBe(0);
  });

  it("does not cap above 100, because bookings can come from older leads", () => {
    expect(conversionRate(10, 20)).toBe(200);
  });
});

describe("source labels", () => {
  it("uses a readable label for known channels", () => {
    expect(leadSourceLabel("GOOGLE_ADS")).toBe("Google Ads");
    expect(leadSourceLabel("meta_ads")).toBe("Meta Ads");
  });

  it("passes an unknown source through unchanged", () => {
    expect(leadSourceLabel("partner-expo")).toBe("partner-expo");
  });
});
