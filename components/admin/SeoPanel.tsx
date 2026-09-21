"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, Share2, Code2, Eye } from "lucide-react";
import { saveSeoPanel } from "@/app/admin/(panel)/seo/actions";
import { Input, Textarea, Label, Select } from "@/components/ui/Field";
import { Card } from "@/components/admin/ui";
import { useToast } from "@/components/admin/Toast";
import { ImageInput } from "@/components/admin/ImageInput";

export type SeoPanelValues = {
  seoTitle: string;
  seoDescription: string;
  canonicalUrl: string;
  focusKeyword: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  twitterTitle: string;
  twitterDescription: string;
  twitterImage: string;
  robotsIndex: boolean;
  robotsFollow: boolean;
  schemaType: string;
  schemaJson: string;
};

export const EMPTY_SEO: SeoPanelValues = {
  seoTitle: "",
  seoDescription: "",
  canonicalUrl: "",
  focusKeyword: "",
  ogTitle: "",
  ogDescription: "",
  ogImage: "",
  twitterTitle: "",
  twitterDescription: "",
  twitterImage: "",
  robotsIndex: true,
  robotsFollow: true,
  schemaType: "",
  schemaJson: "",
};

const TABS = ["Search", "Social", "Advanced"] as const;

/**
 * The SEO controls shared by packages, destinations, blog posts and pages.
 *
 * It saves on its own so each content form does not have to carry fifteen
 * extra fields. Everything here is an override: leave a field empty and the
 * page falls back to its own title, description and image.
 */
export function SeoPanel({
  entityType,
  entityId,
  initial,
  previewPath,
}: {
  entityType: "PACKAGE" | "DESTINATION" | "BLOG" | "PAGE" | "ROUTE";
  entityId: string;
  initial?: Partial<SeoPanelValues>;
  /** Public path, shown in the search-result preview. */
  previewPath?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = React.useState<(typeof TABS)[number]>("Search");
  const [values, setValues] = React.useState<SeoPanelValues>({ ...EMPTY_SEO, ...initial });
  const [saving, setSaving] = React.useState(false);

  const set = <K extends keyof SeoPanelValues>(key: K, value: SeoPanelValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const titleLength = values.seoTitle.length;
  const descriptionLength = values.seoDescription.length;

  const save = async () => {
    setSaving(true);
    try {
      const result = await saveSeoPanel(entityType, entityId, values);
      if (result.ok) {
        toast.success("SEO settings saved.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Could not save the SEO settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mt-6 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-admin-text">Search engine settings</h2>
          <p className="mt-0.5 text-sm text-admin-text-muted">
            Leave a field empty to use the page&rsquo;s own title, description and image.
          </p>
        </div>
        <div className="flex gap-1 rounded-lg bg-admin-muted p-1">
          {TABS.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setTab(name)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                tab === name ? "bg-white text-admin-text shadow-sm" : "text-admin-text-muted hover:text-admin-text"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {tab === "Search" && (
        <div className="space-y-4">
          <div>
            <Label>
              SEO title{" "}
              <span className={titleLength > 60 ? "text-amber-600" : "text-admin-text-subtle"}>
                ({titleLength}/60)
              </span>
            </Label>
            <Input
              value={values.seoTitle}
              onChange={(e) => set("seoTitle", e.target.value)}
              placeholder="Bali Honeymoon Package — 6 Days from ₹54,999"
            />
          </div>

          <div>
            <Label>
              Meta description{" "}
              <span className={descriptionLength > 160 ? "text-amber-600" : "text-admin-text-subtle"}>
                ({descriptionLength}/160)
              </span>
            </Label>
            <Textarea
              rows={3}
              value={values.seoDescription}
              onChange={(e) => set("seoDescription", e.target.value)}
              placeholder="What someone searching would want to read before clicking."
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>Focus keyword</Label>
              <Input
                value={values.focusKeyword}
                onChange={(e) => set("focusKeyword", e.target.value)}
                placeholder="bali honeymoon package"
              />
            </div>
            <div>
              <Label>Canonical URL</Label>
              <Input
                value={values.canonicalUrl}
                onChange={(e) => set("canonicalUrl", e.target.value)}
                placeholder="Leave empty unless this page duplicates another"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>Search engines may index this page</Label>
              <Select
                value={values.robotsIndex ? "index" : "noindex"}
                onChange={(e) => set("robotsIndex", e.target.value === "index")}
              >
                <option value="index">Yes — show it in search results</option>
                <option value="noindex">No — keep it out of search results</option>
              </Select>
            </div>
            <div>
              <Label>Follow the links on this page</Label>
              <Select
                value={values.robotsFollow ? "follow" : "nofollow"}
                onChange={(e) => set("robotsFollow", e.target.value === "follow")}
              >
                <option value="follow">Yes — follow them</option>
                <option value="nofollow">No — do not follow them</option>
              </Select>
            </div>
          </div>

          {/* A rough preview of how the result will read in Google. */}
          <div className="rounded-xl border border-admin bg-admin-bg p-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-admin-text-subtle">
              <Eye className="h-3.5 w-3.5" /> Search preview
            </p>
            <p className="truncate text-xs text-emerald-700">{previewPath || "/"}</p>
            <p className="truncate text-base text-blue-800">
              {values.seoTitle || "Your page title will appear here"}
            </p>
            <p className="line-clamp-2 text-sm text-admin-text-muted">
              {values.seoDescription || "Your meta description will appear here."}
            </p>
          </div>
        </div>
      )}

      {tab === "Social" && (
        <div className="space-y-4">
          <p className="flex items-center gap-2 text-sm text-admin-text-muted">
            <Share2 className="h-4 w-4" /> How this page looks when someone shares the link.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>Facebook / WhatsApp title</Label>
              <Input value={values.ogTitle} onChange={(e) => set("ogTitle", e.target.value)} />
            </div>
            <div>
              <Label>Share image</Label>
              <ImageInput
                value={values.ogImage}
                onChange={(url) => set("ogImage", url)}
                folder="social"
                placeholder="/uploads/… or https://…  (1200×630 works best)"
              />
            </div>
          </div>
          <div>
            <Label>Facebook / WhatsApp description</Label>
            <Textarea
              rows={2}
              value={values.ogDescription}
              onChange={(e) => set("ogDescription", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>X (Twitter) title</Label>
              <Input value={values.twitterTitle} onChange={(e) => set("twitterTitle", e.target.value)} />
            </div>
            <div>
              <Label>X (Twitter) image</Label>
              <ImageInput
                value={values.twitterImage}
                onChange={(url) => set("twitterImage", url)}
                folder="social"
              />
            </div>
          </div>
          <div>
            <Label>X (Twitter) description</Label>
            <Textarea
              rows={2}
              value={values.twitterDescription}
              onChange={(e) => set("twitterDescription", e.target.value)}
            />
          </div>
        </div>
      )}

      {tab === "Advanced" && (
        <div className="space-y-4">
          <p className="flex items-center gap-2 text-sm text-admin-text-muted">
            <Code2 className="h-4 w-4" /> Extra structured data, added alongside what the page
            already generates.
          </p>
          <div>
            <Label>Schema type (label only)</Label>
            <Input
              value={values.schemaType}
              onChange={(e) => set("schemaType", e.target.value)}
              placeholder="e.g. Event"
            />
          </div>
          <div>
            <Label>Custom JSON-LD</Label>
            <Textarea
              rows={8}
              className="font-mono text-xs"
              value={values.schemaJson}
              onChange={(e) => set("schemaJson", e.target.value)}
              placeholder={'{\n  "@context": "https://schema.org",\n  "@type": "Event",\n  "name": "…"\n}'}
            />
            <p className="mt-1 text-xs text-admin-text-muted">
              Must be valid JSON. Only describe things that are actually visible on the page —
              misleading markup gets a site penalised.
            </p>
          </div>
        </div>
      )}

      <div className="mt-5 flex items-center gap-3 border-t border-admin pt-4">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {saving ? "Saving…" : "Save SEO settings"}
        </button>
        <p className="text-xs text-admin-text-muted">Saved separately from the content above.</p>
      </div>
    </Card>
  );
}
