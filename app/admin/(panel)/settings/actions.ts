"use server";

import { revalidatePath } from "next/cache";
import { guardAction } from "@/lib/guard";
import { recordActivity } from "@/lib/activity";
import { saveSettings, DEFAULT_SETTINGS, type SiteSettings } from "@/lib/settings";

function cleanLinks(
  links: { label: string; href: string }[] | undefined,
  fallback: { label: string; href: string }[],
) {
  const cleaned = (links || [])
    .map((l) => ({ label: (l.label || "").trim(), href: (l.href || "").trim() }))
    .filter((l) => l.label && l.href);
  return cleaned.length > 0 ? cleaned : fallback;
}

export async function saveSettingsAction(input: SiteSettings) {
  const guard = await guardAction("settings:manage");
  if (!guard.ok) return { ok: false as const, error: guard.error };
  // Merge over defaults to keep the shape complete.
  const next: SiteSettings = {
    ...DEFAULT_SETTINGS,
    ...input,
    social: { ...DEFAULT_SETTINGS.social, ...input.social },
    analytics: { ...DEFAULT_SETTINGS.analytics, ...input.analytics },
    navigation: {
      ...DEFAULT_SETTINGS.navigation,
      ...input.navigation,
      headerLinks: cleanLinks(input.navigation?.headerLinks, DEFAULT_SETTINGS.navigation.headerLinks),
      footerExploreLinks: cleanLinks(input.navigation?.footerExploreLinks, DEFAULT_SETTINGS.navigation.footerExploreLinks),
      footerSupportLinks: cleanLinks(input.navigation?.footerSupportLinks, DEFAULT_SETTINGS.navigation.footerSupportLinks),
    },
    taxPercent: Number(input.taxPercent) || 0,
    advancePercent: Number(input.advancePercent) || 0,
  };
  await saveSettings(next);

  await recordActivity({
    actor: guard.actor,
    action: "SETTINGS",
    entity: "Settings",
    description: "Updated site settings",
    // Contact details and percentages only — no analytics ids or keys.
    metadata: {
      siteName: next.siteName,
      currency: next.currency,
      taxPercent: next.taxPercent,
      advancePercent: next.advancePercent,
    },
  });

  revalidatePath("/", "layout");
  return { ok: true as const };
}
