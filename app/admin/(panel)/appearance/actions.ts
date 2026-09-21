"use server";

import { revalidatePath } from "next/cache";
import { guardAction } from "@/lib/guard";
import { recordActivity } from "@/lib/activity";
import { getSettings, saveSettings } from "@/lib/settings";
import { DEFAULT_THEME, normalizeTheme, type ThemeSettings } from "@/lib/theme";

export type AppearanceInput = {
  theme: ThemeSettings;
  logoUrl: string;
  faviconUrl: string;
};

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Keep an image field to a path or URL the site can actually serve. */
function cleanImageUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  const v = value.trim();
  if (!v) return "";
  if (v.startsWith("/")) return v.slice(0, 500);
  if (/^https?:\/\//i.test(v)) return v.slice(0, 500);
  // Anything else — `javascript:`, `data:`, a bare word — is dropped rather
  // than rendered into a src attribute.
  return "";
}

export async function saveAppearance(input: AppearanceInput): Promise<ActionResult> {
  const guard = await guardAction("settings:manage");
  if (!guard.ok) return { ok: false, error: guard.error };

  const current = await getSettings();
  // normalizeTheme is the authority on what a theme may contain; whatever the
  // form posts is coerced through it before it is stored, so a crafted
  // request cannot put anything else into the stylesheet.
  const theme = normalizeTheme(input?.theme);

  await saveSettings({
    ...current,
    theme,
    logoUrl: cleanImageUrl(input?.logoUrl),
    faviconUrl: cleanImageUrl(input?.faviconUrl),
  });

  await recordActivity({
    actor: guard.actor,
    action: "SETTINGS",
    entity: "Settings",
    description: "Updated site appearance",
    metadata: {
      brandColor: theme.brandColor,
      headingFont: theme.headingFont,
      bodyFont: theme.bodyFont,
      buttonRadius: theme.buttonRadius,
    },
  });

  // The theme is read by the public layout, so every public page is stale.
  revalidatePath("/", "layout");
  revalidatePath("/admin/appearance");
  return { ok: true };
}

/** Put the appearance back to the shipped defaults. Logo and favicon are left
    alone: they are the admin's own files, not part of the palette. */
export async function resetAppearance(): Promise<ActionResult> {
  const guard = await guardAction("settings:manage");
  if (!guard.ok) return { ok: false, error: guard.error };

  const current = await getSettings();
  await saveSettings({ ...current, theme: DEFAULT_THEME });

  await recordActivity({
    actor: guard.actor,
    action: "SETTINGS",
    entity: "Settings",
    description: "Reset site appearance to defaults",
  });

  revalidatePath("/", "layout");
  revalidatePath("/admin/appearance");
  return { ok: true };
}
