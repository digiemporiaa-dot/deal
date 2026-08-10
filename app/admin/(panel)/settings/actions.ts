"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { saveSettings, DEFAULT_SETTINGS, type SiteSettings } from "@/lib/settings";

export async function saveSettingsAction(input: SiteSettings) {
  try {
    await requireAdmin();
  } catch {
    return { ok: false as const, error: "Not authorized" };
  }
  // Merge over defaults to keep the shape complete.
  const next: SiteSettings = {
    ...DEFAULT_SETTINGS,
    ...input,
    social: { ...DEFAULT_SETTINGS.social, ...input.social },
    analytics: { ...DEFAULT_SETTINGS.analytics, ...input.analytics },
    taxPercent: Number(input.taxPercent) || 0,
    advancePercent: Number(input.advancePercent) || 0,
  };
  await saveSettings(next);
  revalidatePath("/", "layout");
  return { ok: true as const };
}
