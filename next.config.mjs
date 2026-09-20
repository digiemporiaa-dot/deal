/** @type {import('next').NextConfig} */

/**
 * Security headers applied to every response.
 *
 * A full Content-Security-Policy is deliberately not set here: the Razorpay
 * checkout, Google Tag Manager and the inline JSON-LD blocks all need
 * `unsafe-inline`, which would make one worth very little. `frame-ancestors`
 * is set instead, which is the part a meta tag cannot express.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
];

/** Never let a crawler index the admin panel, the API or the customer portal. */
const noIndexHeader = { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" };

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "**.r2.dev" },
      { protocol: "https", hostname: "**.amazonaws.com" },
    ],
    formats: ["image/avif", "image/webp"],
  },
  eslint: {
    // Lint is run explicitly via `npm run lint`; keep it out of the build step.
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Uploaded media carries a timestamp and a random suffix in its name, so
      // a given URL always refers to the same bytes. Without this, files that
      // existed when the server booted are served by Next's static handler
      // with max-age=0 while files uploaded since are served by the /uploads
      // route as immutable — the same image cached differently depending on
      // when it arrived, which is confusing and needlessly chatty.
      {
        source: "/uploads/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      { source: "/admin/:path*", headers: [noIndexHeader] },
      { source: "/api/:path*", headers: [noIndexHeader] },
      { source: "/my-trips/:path*", headers: [noIndexHeader] },
      { source: "/booking/:path*", headers: [noIndexHeader] },
    ];
  },
};

export default nextConfig;
