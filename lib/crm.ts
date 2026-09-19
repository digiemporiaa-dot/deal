/**
 * CRM vocabulary and attribution helpers.
 *
 * Edge-safe and dependency-free so the middleware, the public forms and the
 * admin panel all agree on the same values.
 */

import type { LeadStatus } from "@/types/db-enums";

/**
 * The lead pipeline, in the order it is worked.
 *
 * `CONVERTED` is the won state. It keeps its original name because existing
 * rows use it — the UI labels it "Won".
 */
export const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL_SENT",
  "FOLLOW_UP",
  "CONVERTED",
  "LOST",
] as const satisfies readonly LeadStatus[];

export const LEAD_STATUS_LABELS: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  PROPOSAL_SENT: "Proposal sent",
  FOLLOW_UP: "Follow-up",
  CONVERTED: "Won",
  LOST: "Lost",
};

/** Statuses that close a lead — excluded from "open pipeline" counts. */
export const CLOSED_STATUSES = ["CONVERTED", "LOST"] as const;

export const LEAD_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export type LeadPriority = (typeof LEAD_PRIORITIES)[number];

/** Canonical acquisition channels. */
export const LEAD_SOURCES = [
  "ORGANIC",
  "GOOGLE_ADS",
  "META_ADS",
  "DIRECT",
  "REFERRAL",
  "WHATSAPP",
  "WEBSITE",
  "OTHER",
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_SOURCE_LABELS: Record<string, string> = {
  ORGANIC: "Organic search",
  GOOGLE_ADS: "Google Ads",
  META_ADS: "Meta Ads",
  DIRECT: "Direct",
  REFERRAL: "Referral",
  WHATSAPP: "WhatsApp",
  WEBSITE: "Website form",
  OTHER: "Other",
};

export function leadStatusLabel(status: string): string {
  return LEAD_STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

export function leadSourceLabel(source: string): string {
  return LEAD_SOURCE_LABELS[source.toUpperCase()] ?? source;
}

/** The marketing parameters captured on a visitor's first page view. */
export type Attribution = {
  source: LeadSource;
  medium: string | null;
  campaign: string | null;
  term: string | null;
  content: string | null;
  gclid: string | null;
  fbclid: string | null;
  landingPage: string | null;
  referrer: string | null;
};

export const EMPTY_ATTRIBUTION: Attribution = {
  source: "DIRECT",
  medium: null,
  campaign: null,
  term: null,
  content: null,
  gclid: null,
  fbclid: null,
  landingPage: null,
  referrer: null,
};

const ORGANIC_HOSTS = ["google.", "bing.", "duckduckgo.", "yahoo.", "ecosia.", "brave."];
const SOCIAL_HOSTS = ["facebook.", "instagram.", "fb.com", "l.facebook", "lm.facebook"];

/**
 * Work out the channel from whatever the URL and referrer carry.
 *
 * Click ids win over utm_source, because an ad click is unambiguous even when
 * the tagging is wrong or missing.
 */
export function classifySource(input: {
  utmSource?: string | null;
  utmMedium?: string | null;
  gclid?: string | null;
  fbclid?: string | null;
  referrer?: string | null;
}): LeadSource {
  if (input.gclid) return "GOOGLE_ADS";
  if (input.fbclid) return "META_ADS";

  const source = (input.utmSource || "").toLowerCase();
  const medium = (input.utmMedium || "").toLowerCase();

  if (source.includes("google") && /cpc|ppc|paid/.test(medium)) return "GOOGLE_ADS";
  if (/facebook|meta|instagram|ig/.test(source) && /cpc|ppc|paid|social/.test(medium)) {
    return "META_ADS";
  }
  if (/whatsapp|wa/.test(source)) return "WHATSAPP";
  if (medium === "referral") return "REFERRAL";
  if (medium === "organic") return "ORGANIC";
  if (source) return "OTHER";

  const referrer = (input.referrer || "").toLowerCase();
  if (!referrer) return "DIRECT";
  if (referrer.includes("wa.me") || referrer.includes("whatsapp")) return "WHATSAPP";
  if (ORGANIC_HOSTS.some((host) => referrer.includes(host))) return "ORGANIC";
  if (SOCIAL_HOSTS.some((host) => referrer.includes(host))) return "META_ADS";
  return "REFERRAL";
}

const MAX_PARAM = 200;

function clean(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = String(value).trim().slice(0, MAX_PARAM);
  return trimmed || null;
}

/**
 * Read attribution out of a request URL plus its referrer.
 *
 * Runs on the server (middleware), never in the browser, so ad blockers and
 * script failures cannot lose it.
 */
export function attributionFromUrl(url: URL, referrer?: string | null): Attribution {
  const p = url.searchParams;
  const utmSource = clean(p.get("utm_source"));
  const utmMedium = clean(p.get("utm_medium"));
  const gclid = clean(p.get("gclid"));
  const fbclid = clean(p.get("fbclid"));

  // An internal referrer is not an acquisition source.
  const externalReferrer =
    referrer && !referrer.includes(url.host) ? clean(referrer) : null;

  return {
    source: classifySource({ utmSource, utmMedium, gclid, fbclid, referrer: externalReferrer }),
    medium: utmMedium,
    campaign: clean(p.get("utm_campaign")),
    term: clean(p.get("utm_term")),
    content: clean(p.get("utm_content")),
    gclid,
    fbclid,
    landingPage: `${url.pathname}${url.search}`.slice(0, 500),
    referrer: externalReferrer,
  };
}

/** True when there is anything worth storing. */
export function hasAttribution(a: Attribution): boolean {
  return Boolean(
    a.medium || a.campaign || a.term || a.content || a.gclid || a.fbclid || a.referrer,
  );
}

/** Name of the httpOnly cookie carrying first-touch attribution. */
export const ATTRIBUTION_COOKIE = "vd_attr";

/** How long first-touch attribution survives (30 days, in seconds). */
export const ATTRIBUTION_MAX_AGE = 30 * 24 * 60 * 60;

export function serializeAttribution(a: Attribution): string {
  return JSON.stringify(a);
}

export function parseAttribution(raw: string | null | undefined): Attribution | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Attribution>;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      source: (LEAD_SOURCES as readonly string[]).includes(String(parsed.source))
        ? (parsed.source as LeadSource)
        : "DIRECT",
      medium: clean(parsed.medium),
      campaign: clean(parsed.campaign),
      term: clean(parsed.term),
      content: clean(parsed.content),
      gclid: clean(parsed.gclid),
      fbclid: clean(parsed.fbclid),
      landingPage: clean(parsed.landingPage),
      referrer: clean(parsed.referrer),
    };
  } catch {
    return null;
  }
}

/**
 * Lead → booking conversion rate, as a whole percentage.
 *
 *   conversion = bookings in the period ÷ leads created in the period × 100
 *
 * Leads and bookings are counted in the same window rather than being matched
 * one to one, because a booking can come from a lead raised earlier. With no
 * leads the rate is 0, never a division by zero.
 */
export function conversionRate(leads: number, bookings: number): number {
  if (leads <= 0) return 0;
  return Math.round((bookings / leads) * 1000) / 10;
}
