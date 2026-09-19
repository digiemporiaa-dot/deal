import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";
import { PATHNAME_HEADER } from "@/lib/request-path";
import {
  ATTRIBUTION_COOKIE,
  ATTRIBUTION_MAX_AGE,
  attributionFromUrl,
  hasAttribution,
  serializeAttribution,
} from "@/lib/crm";

/**
 * Edge middleware.
 *
 *  1. Admin access — the `authorized` callback in `authConfig` enforces
 *     authentication and section permissions on /admin/** (except the login
 *     page). It is edge-safe: no Prisma, no bcrypt.
 *
 *  2. Request path — forwarded as a header so `not-found.tsx` can resolve a
 *     database redirect for a URL that matched no route.
 *
 *  3. First-touch marketing attribution — UTM parameters and ad click ids are
 *     read from the landing URL and stored in an httpOnly cookie, so they
 *     survive the whole journey to the lead or booking form without relying
 *     on the browser keeping them. First touch wins: the cookie is only
 *     written when there is not one already.
 */
const { auth } = NextAuth(authConfig);

export default auth((request) => {
  const { pathname } = request.nextUrl;

  // Pass the requested path down to the server components. `not-found.tsx`
  // needs it to look up a redirect for a URL that matched no route.
  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.set(PATHNAME_HEADER, pathname);

  const response = NextResponse.next({ request: { headers: forwardedHeaders } });

  // Never track the admin panel or API traffic.
  if (pathname.startsWith("/admin") || pathname.startsWith("/api")) return response;

  if (request.cookies.get(ATTRIBUTION_COOKIE)) return response;

  const attribution = attributionFromUrl(
    request.nextUrl,
    request.headers.get("referer"),
  );

  // Only write a cookie when there is something worth keeping, so ordinary
  // page responses stay cacheable.
  if (!hasAttribution(attribution)) return response;

  response.cookies.set(ATTRIBUTION_COOKIE, serializeAttribution(attribution), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ATTRIBUTION_MAX_AGE,
  });

  return response;
});

export const config = {
  // Everything except Next internals, static files and the sitemap/robots
  // routes, which must stay cacheable.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|uploads/|.*\\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|css|js|txt|xml|woff|woff2)$).*)",
  ],
};
