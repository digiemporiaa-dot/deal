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
 * Two values are historical and deliberately kept: `PROPOSAL_SENT` is the
 * proposal stage and `CONVERTED` is the won state. Renaming either would mean
 * rewriting live rows, so instead they keep their stored value and the UI
 * labels them "Proposal" and "Won". `NEGOTIATION` and `JUNK` are new — no
 * existing row uses them, so adding them costs no migration at all.
 */
export const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL_SENT",
  "NEGOTIATION",
  "FOLLOW_UP",
  "CONVERTED",
  "LOST",
  "JUNK",
] as const satisfies readonly LeadStatus[];

/** The stored value of the won state. Never hard-code "CONVERTED". */
export const WON_STATUS = "CONVERTED" as const;
/** The stored value of the proposal stage. */
export const PROPOSAL_STATUS = "PROPOSAL_SENT" as const;

export const LEAD_STATUS_LABELS: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  PROPOSAL_SENT: "Proposal",
  NEGOTIATION: "Negotiation",
  FOLLOW_UP: "Follow-up",
  CONVERTED: "Won",
  LOST: "Lost",
  JUNK: "Junk",
};

/**
 * Statuses that close a lead — excluded from "open pipeline" counts, from the
 * follow-up queues and from the nurture sequence. A junk lead is closed for
 * the same reason a lost one is: nobody should be chasing it.
 */
export const CLOSED_STATUSES = ["CONVERTED", "LOST", "JUNK"] as const;

/** Statuses still being worked. */
export const OPEN_STATUSES = LEAD_STATUSES.filter(
  (status) => !(CLOSED_STATUSES as readonly string[]).includes(status),
);

export function isClosedStatus(status: string): boolean {
  return (CLOSED_STATUSES as readonly string[]).includes(status);
}

/** Where a status sits in the pipeline; unknown values sort last. */
export function leadStatusOrder(status: string): number {
  const index = (LEAD_STATUSES as readonly string[]).indexOf(status);
  return index === -1 ? LEAD_STATUSES.length : index;
}

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

/* ───────────────────── phone normalisation ───────────────────── */

/**
 * Reduce a phone number to a comparable key: the last ten digits.
 *
 * "+91 98765 43210", "098765-43210" and "9876543210" all key to
 * "9876543210", which is what makes duplicate detection work at all — people
 * type the same number five different ways. Ten digits is the Indian
 * subscriber length; for a shorter number whatever digits exist are used.
 *
 * Stored in `Lead.phoneKey` / `Customer.phoneKey` so the match is an indexed
 * equality rather than a table scan.
 */
export function normalizePhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = String(value).replace(/\D/g, "");
  if (!digits) return null;
  return digits.slice(-10);
}

/** True when two numbers are the same person, however they were typed. */
export function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalizePhone(a);
  const right = normalizePhone(b);
  return Boolean(left && right && left === right);
}

/** Lower-cased, trimmed email, or null. Used for case-insensitive matching. */
export function normalizeEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = String(value).trim().toLowerCase();
  return trimmed || null;
}

/* ───────────────────────── budget ───────────────────────── */

/**
 * Read a rupee figure out of free text.
 *
 * `Lead.budget` is a free-text field — the website form offers ranges, agents
 * type whatever the customer said. Everything below is real input this has to
 * cope with:
 *
 *   "50000"            → 50000
 *   "₹50,000"          → 50000
 *   "50k"              → 50000
 *   "1.5 lakh"         → 150000
 *   "2L"               → 200000
 *   "₹50,000 - ₹75,000" → 50000   (the lower bound)
 *   "Not sure"         → null
 *
 * The *lower* bound of a range is returned deliberately: scoring a lead on the
 * optimistic end of what it might spend is how a pipeline ends up flattering
 * itself.
 */
export function parseBudget(value: string | null | undefined): number | null {
  if (!value) return null;
  const text = String(value).toLowerCase().replace(/,/g, "");

  // Each number with whatever unit suffix follows it.
  const matches = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(crore|cr|lakh|lac|lakhs|l|k)?/g)];

  const parsed = matches
    .map((match) => ({ digits: Number(match[1]), unit: match[2] }))
    .filter((entry) => Number.isFinite(entry.digits) && entry.digits > 0);

  if (parsed.length === 0) return null;

  // In a range the unit is usually written once, at the end: "1-2 lakh" means
  // one to two lakh, not one rupee. A bare number borrows the unit of the next
  // number that has one — but only when it is small enough to be a multiplier.
  // "50000 or 2 lakh" keeps its fifty thousand, because a five-digit figure is
  // already a rupee amount and nobody means fifty thousand lakh.
  const INHERIT_BELOW = 1_000;
  for (let i = parsed.length - 1; i >= 0; i -= 1) {
    if (parsed[i].unit) continue;
    if (parsed[i].digits >= INHERIT_BELOW) continue;
    const next = parsed.slice(i + 1).find((entry) => entry.unit);
    if (next) parsed[i].unit = next.unit;
  }

  const amounts = parsed.map(({ digits, unit }) => {
    switch (unit) {
      case "crore":
      case "cr":
        return digits * 10_000_000;
      case "lakh":
      case "lac":
      case "lakhs":
      case "l":
        return digits * 100_000;
      case "k":
        return digits * 1_000;
      default:
        return digits;
    }
  });

  return Math.min(...amounts);
}

/* ───────────────────────── tags ───────────────────────── */

/**
 * Tags are stored JSON-encoded in a text column, the same convention
 * `TravelPackage.tags` already uses. Parsing never throws: a corrupt value
 * reads as no tags rather than breaking the page that displays it.
 */
export function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((tag): tag is string => typeof tag === "string")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 20);
  } catch {
    return [];
  }
}

/** Normalise, de-duplicate (case-insensitively) and encode a tag list. */
export function serializeTags(tags: readonly string[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of tags) {
    const clean = String(tag).trim().slice(0, 40);
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
    if (out.length >= 20) break;
  }
  return JSON.stringify(out);
}

/* ───────────────────────── lead scoring ───────────────────────── */

export const SCORE_BANDS = ["HOT", "WARM", "COLD"] as const;

/** A lead scores HOT at or above this, WARM at or above the next one down. */
export const HOT_THRESHOLD = 65;
export const WARM_THRESHOLD = 35;

export type ScoreInput = {
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  destination?: string | null;
  packageId?: string | null;
  budget?: string | null;
  travelDate?: Date | string | null;
  travellers?: number | null;
  adults?: number | null;
  children?: number | null;
  source?: string | null;
  status?: string | null;
  /** How many timeline entries the lead has — calls, notes, emails. */
  activityCount?: number | null;
  lastActivityAt?: Date | string | null;
  /** Injected in tests so scoring is deterministic. */
  now?: Date;
};

export type ScoreReason = { label: string; points: number };

export type LeadScore = {
  score: number;
  band: (typeof SCORE_BANDS)[number];
  reasons: ScoreReason[];
};

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * Score a lead out of 100.
 *
 * Pure and deterministic: the same lead always scores the same, which is what
 * makes the number trustworthy enough to sort a pipeline by and cheap enough
 * to recompute on every write. Nothing here is a model or a guess — each
 * signal is something a travel desk would actually weigh:
 *
 *   contactability  25  can we even reach them, and on what
 *   intent          25  is this a real trip with a date, or a browse
 *   value           20  what is it worth
 *   fit             15  do we know what they want
 *   engagement      15  have they responded to us
 *
 * `reasons` is returned alongside the number so the UI can explain the score
 * rather than presenting it as an oracle.
 */
export function scoreLead(input: ScoreInput): LeadScore {
  const now = input.now ?? new Date();
  const reasons: ScoreReason[] = [];

  const add = (label: string, points: number) => {
    if (points > 0) reasons.push({ label, points });
  };

  // ── Contactability (25) ──
  if (input.email) add("Email address on file", 10);
  if (input.whatsapp) add("WhatsApp number on file", 8);
  if (input.phone) add("Phone number on file", 7);

  // ── Intent: how close the trip is (25) ──
  const travelDate = toDate(input.travelDate);
  if (travelDate) {
    const days = Math.round((travelDate.getTime() - now.getTime()) / DAY);
    if (days < 0) {
      // The date has passed and nobody updated it — that is stale, not urgent.
      add("Travel date already passed", 0);
    } else if (days <= 30) {
      add("Travelling within 30 days", 25);
    } else if (days <= 90) {
      add("Travelling within 3 months", 16);
    } else if (days <= 180) {
      add("Travelling within 6 months", 8);
    } else {
      add("Travel date set", 4);
    }
  }

  // ── Value (20) ──
  const budget = parseBudget(input.budget);
  if (budget !== null) {
    if (budget >= 200_000) add("Budget ₹2L+", 20);
    else if (budget >= 100_000) add("Budget ₹1L+", 16);
    else if (budget >= 50_000) add("Budget ₹50k+", 12);
    else if (budget >= 25_000) add("Budget ₹25k+", 8);
    else add("Budget given", 4);
  }

  // ── Fit: do we know what they want (15) ──
  if (input.packageId) add("Asked about a specific package", 8);
  else if (input.destination) add("Destination named", 5);

  const party =
    (input.travellers ?? 0) || (input.adults ?? 0) + (input.children ?? 0);
  if (party >= 6) add("Group of 6 or more", 7);
  else if (party >= 2) add("Two or more travellers", 4);

  // ── Engagement (15) ──
  const activity = Math.max(0, input.activityCount ?? 0);
  if (activity > 0) {
    add(`${activity} interaction${activity === 1 ? "" : "s"} logged`, Math.min(activity * 3, 9));
  }

  const lastActivity = toDate(input.lastActivityAt);
  if (lastActivity) {
    const idleDays = Math.round((now.getTime() - lastActivity.getTime()) / DAY);
    if (idleDays <= 3) add("Active in the last 3 days", 6);
    else if (idleDays <= 7) add("Active in the last week", 3);
  }

  // ── Channel quality: a modifier, not a category of its own ──
  switch ((input.source || "").toUpperCase()) {
    case "REFERRAL":
      add("Came by referral", 6);
      break;
    case "WHATSAPP":
      add("Came in on WhatsApp", 4);
      break;
    case "GOOGLE_ADS":
      add("Clicked a search ad", 4);
      break;
    case "ORGANIC":
      add("Found us in search", 3);
      break;
    case "META_ADS":
      add("Clicked a social ad", 2);
      break;
    default:
      break;
  }

  const raw = reasons.reduce((sum, reason) => sum + reason.points, 0);
  const score = Math.max(0, Math.min(100, raw));

  // A closed lead is not a prospect, whatever its attributes say.
  if (input.status && isClosedStatus(input.status) && input.status !== WON_STATUS) {
    return { score: 0, band: "COLD", reasons: [{ label: "Lead is closed", points: 0 }] };
  }

  return {
    score,
    band: score >= HOT_THRESHOLD ? "HOT" : score >= WARM_THRESHOLD ? "WARM" : "COLD",
    reasons: reasons.sort((a, b) => b.points - a.points),
  };
}

/** The band a stored score falls in — used where only the number is to hand. */
export function scoreBandFor(score: number): (typeof SCORE_BANDS)[number] {
  if (score >= HOT_THRESHOLD) return "HOT";
  if (score >= WARM_THRESHOLD) return "WARM";
  return "COLD";
}

/**
 * The scoring inputs, read off a lead row.
 *
 * Kept here, beside `scoreLead`, so that every caller feeds it the same
 * fields. The request path (lib/services/lead-scoring.ts) and the maintenance
 * script (prisma/backfill-crm.ts) cannot import each other — one is
 * `server-only`, the other a CLI with its own Prisma client — and without a
 * shared mapping they would quietly drift into scoring leads differently.
 */
export function scoreInputFromLead(
  lead: {
    email?: string | null;
    phone?: string | null;
    whatsapp?: string | null;
    destination?: string | null;
    packageId?: string | null;
    budget?: string | null;
    travelDate?: Date | string | null;
    travellers?: number | null;
    adults?: number | null;
    children?: number | null;
    source?: string | null;
    status?: string | null;
    lastActivityAt?: Date | string | null;
  },
  activityCount: number,
  now?: Date,
): ScoreInput {
  return {
    email: lead.email ?? null,
    phone: lead.phone ?? null,
    whatsapp: lead.whatsapp ?? null,
    destination: lead.destination ?? null,
    packageId: lead.packageId ?? null,
    budget: lead.budget ?? null,
    travelDate: lead.travelDate ?? null,
    travellers: lead.travellers ?? null,
    adults: lead.adults ?? null,
    children: lead.children ?? null,
    source: lead.source ?? null,
    status: lead.status ?? null,
    activityCount,
    lastActivityAt: lead.lastActivityAt ?? null,
    now,
  };
}

/* ───────────────────── follow-up urgency ───────────────────── */

export const QUEUE_BUCKETS = ["overdue", "today", "tomorrow", "week", "later"] as const;
export type QueueBucket = (typeof QUEUE_BUCKETS)[number];

export const BUCKET_LABELS: Record<QueueBucket, string> = {
  overdue: "Overdue",
  today: "Today",
  tomorrow: "Tomorrow",
  week: "This week",
  later: "Later",
};

/**
 * How overdue a follow-up has to be before it is escalated.
 *
 * Three days: one day late is somebody having a busy morning, three days late
 * is a lead quietly going cold. The queue page, the row badge and the manager
 * digest all read this, so they cannot disagree about what "late" means.
 */
export const ESCALATION_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Day boundaries for bucketing, from one reference instant.
 *
 * Computed once per request and passed in, so every task in a queue is
 * bucketed against the same clock — otherwise a list rendering across
 * midnight could put two identical due dates in different buckets.
 */
export function dayEdges(now: Date = new Date()) {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const endOfTomorrow = new Date(endOfToday);
  endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);

  const endOfWeek = new Date(endOfToday);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  return { startOfToday, endOfToday, endOfTomorrow, endOfWeek };
}

/** Which urgency bucket a due date falls in. */
export function bucketFor(dueAt: Date, edges: ReturnType<typeof dayEdges>): QueueBucket {
  if (dueAt < edges.startOfToday) return "overdue";
  if (dueAt <= edges.endOfToday) return "today";
  if (dueAt <= edges.endOfTomorrow) return "tomorrow";
  if (dueAt <= edges.endOfWeek) return "week";
  return "later";
}

/**
 * Whole days a task is late; 0 when it is not overdue yet.
 *
 * Counted in calendar days from the start of today, not in elapsed hours, so
 * something due at 5pm yesterday reads as "1 day late" this morning rather
 * than "0" — which is how a person would describe it.
 */
export function daysLate(dueAt: Date, edges: ReturnType<typeof dayEdges>): number {
  if (dueAt >= edges.startOfToday) return 0;
  return Math.max(1, Math.floor((edges.startOfToday.getTime() - dueAt.getTime()) / DAY_MS) + 1);
}

export function isEscalated(dueAt: Date, edges: ReturnType<typeof dayEdges>): boolean {
  return daysLate(dueAt, edges) >= ESCALATION_DAYS;
}
