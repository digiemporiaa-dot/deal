"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, Check } from "lucide-react";
import { Label, Select, controlClasses } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { ImageInput } from "@/components/admin/ImageInput";
import { useToast } from "@/components/admin/Toast";
import {
  DEFAULT_THEME,
  FONTS,
  FONT_KEYS,
  RADIUS_KEYS,
  brandScale,
  channels,
  parseHex,
  type ButtonRadius,
  type FontKey,
  type ThemeSettings,
} from "@/lib/theme";
import {
  resetAppearance,
  saveAppearance,
  type ActionResult,
} from "@/app/admin/(panel)/appearance/actions";

/**
 * Appearance controls.
 *
 * The preview is the point of the screen. Colour names mean very little on
 * their own — "is #1b70f1 too dark for a button?" is not a question anyone
 * can answer from the hex — so every control writes straight into a live
 * sample of the real components, using the same derived palette the public
 * site will use. Nothing is guessed twice.
 */

type Props = { initial: ThemeSettings; logoUrl: string; faviconUrl: string };

type ColorField = { key: keyof ThemeSettings; label: string; help: string };

const BRAND_FIELDS: ColorField[] = [
  { key: "brandColor", label: "Brand colour", help: "Links and highlights, and the primary button. The rest of the palette is derived from this." },
  { key: "headingColor", label: "Headings", help: "Every h1–h4 on the site." },
  { key: "bodyColor", label: "Body text", help: "Paragraphs and descriptions." },
  { key: "pageBackground", label: "Page background", help: "Behind the whole site." },
  { key: "headerBackground", label: "Header background", help: "The sticky bar at the top." },
  { key: "footerBackground", label: "Footer background", help: "The block at the bottom." },
  { key: "footerText", label: "Footer text", help: "Text inside the footer." },
];

const PRIMARY_BUTTON_FIELDS: ColorField[] = [
  { key: "brandColor", label: "Background", help: "This is the brand colour — changing it here changes it everywhere." },
  { key: "buttonTextColor", label: "Text", help: "Keep it readable against the background." },
];

const SECONDARY_BUTTON_FIELDS: ColorField[] = [
  { key: "secondaryButtonColor", label: "Background", help: "The second button style, used beside a primary one." },
  { key: "secondaryButtonTextColor", label: "Text", help: "Keep it readable against the background." },
];

const RADIUS_LABELS: Record<ButtonRadius, string> = {
  none: "Square",
  small: "Slightly rounded",
  medium: "Rounded",
  large: "Very rounded",
  pill: "Pill",
};

export function AppearanceForm({ initial, logoUrl: initialLogo, faviconUrl: initialFavicon }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [theme, setTheme] = React.useState<ThemeSettings>(initial);
  const [logoUrl, setLogoUrl] = React.useState(initialLogo);
  const [faviconUrl, setFaviconUrl] = React.useState(initialFavicon);
  const [saving, setSaving] = React.useState(false);
  const [resetting, setResetting] = React.useState(false);

  const set = <K extends keyof ThemeSettings>(key: K, value: ThemeSettings[K]) =>
    setTheme((t) => ({ ...t, [key]: value }));

  const dirty =
    JSON.stringify(theme) !== JSON.stringify(initial) ||
    logoUrl !== initialLogo ||
    faviconUrl !== initialFavicon;

  // The preview's own variables, built with the same functions the server
  // uses, so what is on screen is what will ship.
  const previewVars = React.useMemo(() => {
    const base = parseHex(theme.brandColor) ?? parseHex(DEFAULT_THEME.brandColor)!;
    const scale = brandScale(base);
    const vars: Record<string, string> = {};
    for (const [step, rgb] of Object.entries(scale)) vars[`--brand-${step}`] = channels(rgb);
    const solid = (v: string, f: string) => channels(parseHex(v) ?? parseHex(f)!);
    vars["--site-heading"] = solid(theme.headingColor, DEFAULT_THEME.headingColor);
    vars["--site-body"] = solid(theme.bodyColor, DEFAULT_THEME.bodyColor);
    vars["--site-bg"] = solid(theme.pageBackground, DEFAULT_THEME.pageBackground);
    vars["--site-header-bg"] = solid(theme.headerBackground, DEFAULT_THEME.headerBackground);
    vars["--site-footer-bg"] = solid(theme.footerBackground, DEFAULT_THEME.footerBackground);
    vars["--site-footer-text"] = solid(theme.footerText, DEFAULT_THEME.footerText);
    vars["--site-button-text"] = solid(theme.buttonTextColor, DEFAULT_THEME.buttonTextColor);
    vars["--site-button-2-bg"] = solid(theme.secondaryButtonColor, DEFAULT_THEME.secondaryButtonColor);
    vars["--site-button-2-text"] = solid(
      theme.secondaryButtonTextColor,
      DEFAULT_THEME.secondaryButtonTextColor,
    );
    vars["--font-display"] = FONTS[theme.headingFont].stack;
    vars["--font-sans"] = FONTS[theme.bodyFont].stack;
    return vars as React.CSSProperties;
  }, [theme]);

  const radiusPx = { none: 0, small: 6, medium: 8, large: 16, pill: 9999 }[theme.buttonRadius];

  const onSave = async () => {
    setSaving(true);
    const res: ActionResult = await saveAppearance({ theme, logoUrl, faviconUrl });
    setSaving(false);
    if (res.ok) {
      toast.success("Appearance saved. The public site has been updated.");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  };

  const onReset = async () => {
    if (!confirm("Put every colour, font and button shape back to the defaults? Your logo is kept.")) return;
    setResetting(true);
    const res = await resetAppearance();
    setResetting(false);
    if (res.ok) {
      setTheme(DEFAULT_THEME);
      toast.success("Appearance reset to defaults.");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
      {/* ── controls ── */}
      <div className="space-y-6">
        <Card title="Logo & favicon" hint="Shown in the header and the browser tab.">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label>Logo</Label>
              <ImageInput value={logoUrl} onChange={setLogoUrl} folder="branding" />
              <p className="mt-1 text-xs text-admin-text-muted">
                Replaces the site name in the header. A wide PNG or SVG with a transparent
                background works best; it is shown 36px tall.
              </p>
            </div>
            <div>
              <Label>Favicon</Label>
              <ImageInput value={faviconUrl} onChange={setFaviconUrl} folder="branding" />
              <p className="mt-1 text-xs text-admin-text-muted">
                The small square icon in the browser tab. 32×32 or 64×64.
              </p>
            </div>
          </div>
        </Card>

        <Card title="Colours" hint="Pick a colour or type a hex code. Both stay in step.">
          <div className="grid gap-4 sm:grid-cols-2">
            {BRAND_FIELDS.map((f) => (
              <ColorField
                key={f.key}
                label={f.label}
                help={f.help}
                value={theme[f.key] as string}
                onChange={(v) => set(f.key, v as never)}
              />
            ))}
          </div>
        </Card>

        <Card title="Typography" hint="One font for headings, one for everything else.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="headingFont">Heading font</Label>
              <Select
                id="headingFont"
                value={theme.headingFont}
                onChange={(e) => set("headingFont", e.target.value as FontKey)}
              >
                {FONT_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {FONTS[k].label}
                    {FONTS[k].kind === "serif" ? " — serif" : ""}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="bodyFont">Body font</Label>
              <Select
                id="bodyFont"
                value={theme.bodyFont}
                onChange={(e) => set("bodyFont", e.target.value as FontKey)}
              >
                {FONT_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {FONTS[k].label}
                    {FONTS[k].kind === "serif" ? " — serif" : ""}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <p className="mt-2 text-xs text-admin-text-muted">
            Anything other than “System default” and Georgia is loaded from Google Fonts, which
            adds one request to every page.
          </p>
        </Card>

        <Card title="Buttons" hint="Applies to every button on the public site, including buttons placed with the page builder.">
          <div className="mb-5 grid gap-5 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-admin-text-muted">
                Primary button
              </p>
              <div className="space-y-3">
                {PRIMARY_BUTTON_FIELDS.map((f) => (
                  <ColorField
                    key={`primary-${String(f.key)}`}
                    label={f.label}
                    help={f.help}
                    value={theme[f.key] as string}
                    onChange={(v) => set(f.key, v as never)}
                  />
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-admin-text-muted">
                Secondary button
              </p>
              <div className="space-y-3">
                {SECONDARY_BUTTON_FIELDS.map((f) => (
                  <ColorField
                    key={`secondary-${String(f.key)}`}
                    label={f.label}
                    help={f.help}
                    value={theme[f.key] as string}
                    onChange={(v) => set(f.key, v as never)}
                  />
                ))}
              </div>
            </div>
          </div>

          <Label>Corner shape</Label>
          <div className="flex flex-wrap gap-2">
            {RADIUS_KEYS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => set("buttonRadius", r)}
                aria-pressed={theme.buttonRadius === r}
                className={
                  theme.buttonRadius === r
                    ? "border-2 border-brand-600 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-700"
                    : "border border-admin-border-strong bg-white px-4 py-2 text-sm text-admin-text hover:bg-admin-muted"
                }
                style={{ borderRadius: { none: 0, small: 6, medium: 8, large: 16, pill: 9999 }[r] }}
              >
                {RADIUS_LABELS[r]}
              </button>
            ))}
          </div>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={onSave} disabled={saving || !dirty}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? "Saving…" : "Save appearance"}
          </Button>
          <Button variant="outline" onClick={onReset} disabled={resetting}>
            {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            Reset to defaults
          </Button>
          {dirty && !saving && (
            <span className="text-sm text-admin-text-muted">
              Unsaved changes — the preview is showing them, the live site is not.
            </span>
          )}
        </div>
      </div>

      {/* ── preview ── */}
      <div className="xl:sticky xl:top-[calc(var(--admin-topbar-h)+16px)] xl:self-start">
        <div className="overflow-hidden rounded-2xl border border-admin bg-white">
          <p className="border-b border-admin bg-admin-muted px-4 py-2 text-xs font-semibold uppercase tracking-wide text-admin-text-muted">
            Live preview
          </p>
          <div style={previewVars} className="text-[15px]">
            <div
              className="flex items-center justify-between gap-3 border-b px-5 py-3.5"
              style={{ background: "rgb(var(--site-header-bg))", borderColor: "rgba(0,0,0,.08)" }}
            >
              <span
                className="font-bold"
                style={{ color: "rgb(var(--site-heading))", fontFamily: "var(--font-display)" }}
              >
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- arbitrary host, unknown dimensions
                  <img src={logoUrl} alt="" className="h-8 w-auto max-w-[160px] object-contain" />
                ) : (
                  "Your site"
                )}
              </span>
              <span className="text-sm" style={{ color: "rgb(var(--site-body))", fontFamily: "var(--font-sans)" }}>
                Packages · Blog
              </span>
            </div>

            <div className="px-5 py-6" style={{ background: "rgb(var(--site-bg))" }}>
              <p
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: "rgb(var(--brand-600))", fontFamily: "var(--font-sans)" }}
              >
                Explore the world
              </p>
              <h3
                className="mt-1.5 text-2xl font-bold"
                style={{ color: "rgb(var(--site-heading))", fontFamily: "var(--font-display)" }}
              >
                Crafted journeys, thoughtfully priced
              </h3>
              <p className="mt-2 text-sm" style={{ color: "rgb(var(--site-body))", fontFamily: "var(--font-sans)" }}>
                This block shows your real heading and body fonts, at the colours you have chosen.
                Everything below uses the palette derived from your brand colour.
              </p>

              <div className="mt-4 flex flex-wrap gap-2.5" style={{ fontFamily: "var(--font-sans)" }}>
                <span
                  className="inline-flex h-10 items-center px-5 text-sm font-semibold"
                  style={{
                    background: "rgb(var(--brand-600))",
                    color: "rgb(var(--site-button-text))",
                    borderRadius: radiusPx,
                  }}
                >
                  Book now
                </span>
                <span
                  className="inline-flex h-10 items-center px-5 text-sm font-semibold"
                  style={{
                    background: "rgb(var(--site-button-2-bg))",
                    color: "rgb(var(--site-button-2-text))",
                    borderRadius: radiusPx,
                  }}
                >
                  Enquire
                </span>
                <span
                  className="inline-flex h-10 items-center border px-5 text-sm font-semibold"
                  style={{
                    borderColor: "rgb(var(--brand-600))",
                    color: "rgb(var(--brand-600))",
                    borderRadius: radiusPx,
                  }}
                >
                  Outline
                </span>
              </div>

              <div
                className="mt-5 rounded-xl p-4"
                style={{ background: "rgb(var(--brand-50))", fontFamily: "var(--font-sans)" }}
              >
                <p className="text-sm font-semibold" style={{ color: "rgb(var(--brand-700))" }}>
                  A highlighted panel
                </p>
                <p className="mt-0.5 text-xs" style={{ color: "rgb(var(--site-body))" }}>
                  Uses the lightest and darkest ends of your derived palette.
                </p>
              </div>

              <div className="mt-5">
                <p className="mb-1.5 text-xs font-medium" style={{ color: "rgb(var(--site-body))" }}>
                  Derived palette
                </p>
                <div className="flex overflow-hidden rounded-lg">
                  {["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"].map((s) => (
                    <span
                      key={s}
                      title={`brand-${s}`}
                      className="h-7 flex-1"
                      style={{ background: `rgb(var(--brand-${s}))` }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div
              className="px-5 py-4 text-xs"
              style={{
                background: "rgb(var(--site-footer-bg))",
                color: "rgb(var(--site-footer-text))",
                fontFamily: "var(--font-sans)",
              }}
            >
              © {new Date().getFullYear()} Your site. All rights reserved.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-admin bg-white p-6">
      <h2 className="font-semibold text-admin-text">{title}</h2>
      {hint && <p className="mb-4 mt-0.5 text-sm text-admin-text-muted">{hint}</p>}
      {!hint && <div className="mb-4" />}
      {children}
    </section>
  );
}

/**
 * A colour swatch and a hex box that stay in step.
 *
 * The native picker cannot show an invalid value, so the text box keeps
 * whatever is typed while it is being typed and only the picker waits for it
 * to become a real colour. Otherwise deleting a character to edit a hex code
 * fights the control.
 */
function ColorField({
  label,
  help,
  value,
  onChange,
}: {
  label: string;
  help?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const valid = parseHex(value) !== null;
  const id = React.useId();

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <input
          type="color"
          aria-label={`${label} colour picker`}
          value={valid ? value : DEFAULT_THEME.brandColor}
          onChange={(e) => onChange(e.target.value)}
          className="h-[42px] w-12 shrink-0 cursor-pointer rounded-lg border border-admin-border-strong bg-white p-1"
        />
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          className={controlClasses("md", `min-w-0 flex-1 font-mono ${valid ? "" : "border-red-400"}`)}
        />
      </div>
      {!valid && <p className="mt-1 text-xs text-red-600">Not a hex colour — this one will be ignored.</p>}
      {help && valid && <p className="mt-1 text-xs text-admin-text-muted">{help}</p>}
    </div>
  );
}
