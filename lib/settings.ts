import "server-only";
import { prisma } from "@/lib/db";
import { cache } from "react";

/**
 * Central site settings. Stored as a single JSON row (SiteSetting id=1) so a
 * non-technical admin can edit everything (contact info, WhatsApp, currency,
 * tax, social links, analytics) without touching code.
 */
export type SiteSettings = {
  siteName: string;
  tagline: string;
  logoUrl: string;
  faviconUrl: string;
  email: string;
  phone: string;
  whatsapp: string;
  address: string;
  businessHours: string;
  currency: string;
  taxPercent: number;
  advancePercent: number;
  social: {
    facebook: string;
    instagram: string;
    twitter: string;
    youtube: string;
    linkedin: string;
  };
  analytics: {
    googleAnalyticsId: string;
    metaPixelId: string;
    googleTagManagerId: string;
  };
};

export const DEFAULT_SETTINGS: SiteSettings = {
  siteName: "Vacationdeal",
  tagline: "Crafted journeys to the places you have always dreamed of.",
  logoUrl: "",
  faviconUrl: "",
  email: "hello@vacationdeal.test",
  phone: "+91 98765 43210",
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "919876543210",
  address: "123 Marine Drive, Mumbai, India",
  businessHours: "Mon–Sat, 10:00 AM – 7:00 PM",
  currency: "INR",
  taxPercent: 5,
  advancePercent: 25,
  social: {
    facebook: "",
    instagram: "",
    twitter: "",
    youtube: "",
    linkedin: "",
  },
  analytics: {
    googleAnalyticsId: "",
    metaPixelId: "",
    googleTagManagerId: "",
  },
};

/**
 * Read settings, merged over defaults. Cached per-request via React cache.
 * Never throws — falls back to defaults if the DB is unavailable so public
 * pages keep rendering.
 */
export const getSettings = cache(async (): Promise<SiteSettings> => {
  try {
    const row = await prisma.siteSetting.findUnique({ where: { id: 1 } });
    if (!row) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(row.data as Partial<SiteSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
});

export async function saveSettings(next: SiteSettings): Promise<void> {
  await prisma.siteSetting.upsert({
    where: { id: 1 },
    create: { id: 1, data: next },
    update: { data: next },
  });
}
