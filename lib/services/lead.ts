import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  ATTRIBUTION_COOKIE,
  EMPTY_ATTRIBUTION,
  classifySource,
  parseAttribution,
  type Attribution,
} from "@/lib/crm";
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

  const lead = await prisma.lead.create({
    data: {
      name: input.name,
      email: input.email || null,
      phone: input.phone,
      whatsapp: input.whatsapp || null,
      destination: input.destination || null,
      travelDate: toDate(input.travelDate),
      returnDate: toDate(input.returnDate),
      travellers: input.travellers ?? null,
      adults: input.adults ?? null,
      children: input.children ?? null,
      country: input.country || null,
      budget: input.budget || null,
      message: input.message || null,

      // Channel from attribution; the form name is kept in the campaign-less
      // case as a readable fallback.
      source: attribution.source === "DIRECT" ? (input.source || "WEBSITE").toUpperCase() : attribution.source,
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
  });

  return lead;
}

function toDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
