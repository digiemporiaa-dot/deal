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
      { source: "/admin/:path*", headers: [noIndexHeader] },
      { source: "/api/:path*", headers: [noIndexHeader] },
      { source: "/my-trips/:path*", headers: [noIndexHeader] },
      { source: "/booking/:path*", headers: [noIndexHeader] },
    ];
  },
};

export default nextConfig;
