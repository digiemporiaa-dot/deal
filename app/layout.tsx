import type { Metadata } from "next";
import "./globals.css";
import { getSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: `${s.siteName} — Travel Packages & Holidays`,
      template: `%s | ${s.siteName}`,
    },
    description: s.tagline,
    openGraph: {
      type: "website",
      siteName: s.siteName,
      title: `${s.siteName} — Travel Packages & Holidays`,
      description: s.tagline,
    },
    twitter: { card: "summary_large_image" },
    icons: s.faviconUrl ? { icon: s.faviconUrl } : undefined,
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* suppressHydrationWarning: some browser extensions (e.g. ColorZilla adds
          `cz-shortcut-listen`) mutate <body> before hydration, causing a
          harmless server/client mismatch. This suppresses that one-level warning. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
