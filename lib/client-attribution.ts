/**
 * Browser-side attribution fallback.
 *
 * The authoritative capture is the httpOnly cookie the middleware writes on
 * the visitor's first page view. This is only a backstop for the rare client
 * that blocks cookies — the server prefers the cookie whenever it exists.
 */
export type SubmittedAttribution = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  gclid?: string;
  fbclid?: string;
  landingPage?: string;
  referrer?: string;
};

const PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
] as const;

export function readClientAttribution(): SubmittedAttribution | undefined {
  if (typeof window === "undefined") return undefined;

  try {
    const url = new URL(window.location.href);
    const out: SubmittedAttribution = {};

    for (const key of PARAMS) {
      const value = url.searchParams.get(key);
      if (value) out[key] = value.slice(0, 200);
    }

    out.landingPage = `${url.pathname}${url.search}`.slice(0, 500);

    const referrer = document.referrer;
    if (referrer && !referrer.includes(url.host)) out.referrer = referrer.slice(0, 500);

    return out;
  } catch {
    return undefined;
  }
}
