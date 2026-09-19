import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

/**
 * robots.txt.
 *
 * Everything private or duplicative is excluded: the admin panel, the API,
 * the customer portal, the checkout, and the filtered/sorted variants of the
 * package listing, which would otherwise compete with the canonical listing.
 */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/admin/",
          "/api/",
          "/booking",
          "/my-trips",
          "/uploads/",
          // Parameterised listings — the canonical page is indexed instead.
          "/packages?",
          "/destinations?",
          "/*?q=",
          "/*?sort=",
          "/*?page=",
          "/*?utm_",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
