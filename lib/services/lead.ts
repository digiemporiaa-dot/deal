import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  ATTRIBUTION_COOKIE,
  EMPTY_ATTRIBUTION,
  classifySource,
  normalizePhone,
  parseAttribution,
  scoreLead,
  type Attribution,
} from "@/lib/crm";
import { findDuplicateLeads } from "@/lib/services/lead-dedupe";
import type { LeadInput } from "@/lib/validation";

/**
 * Resolve the attribution to store against a new lead.
 *
 * Preference order:
 *   1. the httpOnly first-touch cookie written by the middleware
 *   2. whatever the form posted (a fallback for clients that block cookies)
 *   3. nothing — recorded as DIRECT
 *
 * The cookie wins because it is set server-side on the landing page, before
 * any client script has had a chance to lose or rewrite the parameters.
 */
export async function resolveAttribution(
  submitted?: LeadInput["utm"],
): Promise<Attribution> {
  try {
    const jar = await cookies();
    const fromCookie = parseAttribution(jar.get(ATTRIBUTION_COOKIE)?.value);
    if (fromCookie) return fromCookie;
  } catch {
    // `cookies()` is unavailable outside a request scope — fall through.
  }

  if (!submitted) return EMPTY_ATTRIBUTION;

  return {
    source: classifySource({
      utmSource: submitted.utm_source,
      utmMedium: submitted.utm_medium,
      gclid: submitted.gclid,
      fbclid: submitted.fbclid,
      referrer: submitted.referrer,
    }),
    medium: submitted.utm_medium ?? null,
    campaign: submitted.utm_campaign ?? null,
    term: submitted.utm_term ?? null,
    content: submitted.utm_content ?? null,
    gclid: submitted.gclid ?? null,
    fbclid: submitted.fbclid ?? null,
    landingPage: submitted.landingPage ?? null,
    referrer: submitted.referrer ?? null,
  };
}

/**
 * Create a lead with its marketing attribution attached.
 *
 * `input` has already been validated with `leadSchema`; the form's own
 * `source` is kept as a description of which form was used, while the
 * channel comes from the attribution.
 */
export async function createLead(input: LeadInput) {
  const attribution = await resolveAttribution(input.utm);

  const source =
    attribution.source === "DIRECT"
      ? (input.source || "WEBSITE").toUpperCase()
      : attribution.source;

  const travelDate = toDate(input.travelDate);

  // Scored at creation so it is sortable the moment it lands. A brand-new
  // enquiry has no interactions yet, which is why an incomplete form scores
  // cold rather than unknown.
  const scored = scoreLead({
    email: input.email || null,
    phone: input.phone,
    whatsapp: input.whatsapp || null,
    destination: input.destination || null,
    budget: input.budget || null,
    travelDate,
    travellers: input.travellers ?? null,
    adults: input.adults ?? null,
    children: input.children ?? null,
    source,
    status: "NEW",
    activityCount: 0,
  });

  // Flagged, never blocked. A returning customer filling the form again is
  // not an error, and refusing their enquiry would lose real business — the
  // duplicate is recorded so the desk can merge or ignore it.
  const duplicates = await findDuplicateLeads({
    phone: input.phone,
    email: input.email || null,
    limit: 3,
  });

  const lead = await prisma.lead.create({
    data: {
      name: input.name,
      email: input.email || null,
      phone: input.phone,
      phoneKey: normalizePhone(input.phone),
      whatsapp: input.whatsapp || null,
      destination: input.destination || null,
      travelDate,
      returnDate: toDate(input.returnDate),
      travellers: input.travellers ?? null,
      adults: input.adults ?? null,
      children: input.children ?? null,
      country: input.country || null,
      budget: input.budget || null,
      message: input.message || null,
      score: scored.score,
      scoreBand: scored.band,

      // Channel from attribution; the form name is kept in the campaign-less
      // case as a readable fallback.
      source,
      medium: attribution.medium,
      campaign: attribution.campaign,
      term: attribution.term,
      content: attribution.content,
      gclid: attribution.gclid,
      fbclid: attribution.fbclid,
      landingPage: attribution.landingPage,
      referrer: attribution.referrer,

      status: "NEW",
      lastActivityAt: new Date(),
    },
    select: { id: true, name: true, source: true, campaign: true },
  });

  logger.info("lead.created", {
    leadId: lead.id,
    source: lead.source,
    campaign: lead.campaign,
    score: scored.score,
    band: scored.band,
    duplicateOf: duplicates.leads.map((row) => row.id),
  });

  // Recorded on the new lead's own timeline so whoever picks it up sees the
  // history before they call, rather than after.
  if (duplicates.isDuplicate) {
    const names = duplicates.leads
      .map((row) => `${row.name} (${row.statusLabel})`)
      .join(", ");
    await prisma.leadNote
      .create({
        data: {
          leadId: lead.id,
          type: "DUPLICATE",
          body: `Possible duplicate of ${duplicates.leads.length} earlier enquiry/enquiries: ${names}`,
        },
      })
      .catch((error) => logger.error("lead.duplicate_note_failed", { leadId: lead.id, error }));
  }

  return { ...lead, score: scored.score, scoreBand: scored.band, duplicates };
}

function toDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
