"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { ImageIcon, Loader2, X } from "lucide-react";
import { useToast } from "@/components/admin/Toast";
import { MediaPicker } from "@/components/builder/editor/MediaPicker";
import { updatePageDetails } from "@/app/admin/(panel)/pages/builder-actions";

/**
 * Page settings and SEO, inside the builder.
 *
 * Everything an admin needs to finish a page lives here — title, address and
 * the search and social preview — so publishing never requires a trip to a
 * different screen or a developer.
 *
 * Renaming the address creates a redirect from the old one server-side, so an
 * indexed URL keeps working; the note below tells the admin that.
 */

export type PageDetails = {
  id: string;
  title: string;
  slug: string;
  seoTitle: string;
  seoDescription: string;
  ogImage: string;
};

const TITLE_LIMIT = 60;
const DESCRIPTION_LIMIT = 160;

export function PageSettingsDialog({
  page,
  onClose,
  onSaved,
}: {
  page: PageDetails;
  onClose: () => void;
  onSaved: (details: { title: string; slug: string }) => void;
}) {
  const toast = useToast();
  const [mounted, setMounted] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [picking, setPicking] = React.useState(false);
  const [form, setForm] = React.useState(page);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending && !picking) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, pending, picking]);

  const set = (key: keyof PageDetails) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setPending(true);
    try {
      const result = await updatePageDetails(page.id, {
        title: form.title,
        slug: form.slug,
        seoTitle: form.seoTitle,
        seoDescription: form.seoDescription,
        ogImage: form.ogImage,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      // The server may have adjusted the slug to keep it unique.
      setForm((current) => ({ ...current, slug: result.slug }));
      onSaved({ title: form.title, slug: result.slug });
      toast.success("Page settings saved.");
      onClose();
    } finally {
      setPending(false);
    }
  };

  if (!mounted) return null;

  const previewTitle = form.seoTitle || form.title;
  const slugChanged = form.slug !== page.slug;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="page-settings-title"
      className="fixed inset-0 z-[130] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 py-10"
      onClick={() => !pending && !picking && onClose()}
    >
      <div
        className="w-full max-w-xl rounded-2xl bg-white p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 id="page-settings-title" className="font-semibold text-slate-900">
              Page settings
            </h2>
            <p className="text-xs text-slate-500">Title, address and how this page looks in search.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <Field label="Page title" htmlFor="ps-title">
          <input
            id="ps-title"
            value={form.title}
            onChange={(event) => set("title")(event.target.value)}
            className={input}
          />
        </Field>

        <Field label="Address" htmlFor="ps-slug" help={
          slugChanged
            ? "The old address will redirect here automatically, so existing links keep working."
            : "The part of the URL after the domain."
        }>
          <div className="flex items-center rounded-lg border border-slate-300 focus-within:border-brand-500">
            <span className="pl-3 text-sm text-slate-400">/</span>
            <input
              id="ps-slug"
              value={form.slug}
              onChange={(event) => set("slug")(event.target.value)}
              className="w-full bg-transparent px-1 py-2.5 text-sm focus:outline-none"
            />
          </div>
        </Field>

        <hr className="my-5 border-slate-100" />

        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Search engines
        </p>

        <Field
          label="SEO title"
          htmlFor="ps-seo-title"
          help={`Leave empty to use the page title. ${form.seoTitle.length}/${TITLE_LIMIT} characters shown in search.`}
          warn={form.seoTitle.length > TITLE_LIMIT}
        >
          <input
            id="ps-seo-title"
            value={form.seoTitle}
            placeholder={form.title}
            onChange={(event) => set("seoTitle")(event.target.value)}
            className={input}
          />
        </Field>

        <Field
          label="Meta description"
          htmlFor="ps-seo-description"
          help={`${form.seoDescription.length}/${DESCRIPTION_LIMIT} characters shown in search.`}
          warn={form.seoDescription.length > DESCRIPTION_LIMIT}
        >
          <textarea
            id="ps-seo-description"
            rows={3}
            value={form.seoDescription}
            onChange={(event) => set("seoDescription")(event.target.value)}
            className={input}
          />
        </Field>

        <Field label="Share image" help="Used when the page is shared on social media.">
          <div className="flex items-center gap-3">
            {form.ogImage ? (
              /* eslint-disable-next-line @next/next/no-img-element -- an admin can point
                 this at any host; next/image needs each one listed in remotePatterns and
                 throws at request time for the rest. */
              <img
                src={form.ogImage}
                alt=""
                className="h-16 w-28 rounded-lg border border-slate-200 object-cover"
              />
            ) : (
              <div className="grid h-16 w-28 place-items-center rounded-lg border border-dashed border-slate-300 text-slate-300">
                <ImageIcon className="h-5 w-5" />
              </div>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => setPicking(true)} className={secondaryButton}>
                Choose image
              </button>
              {form.ogImage && (
                <button type="button" onClick={() => set("ogImage")("")} className={secondaryButton}>
                  Remove
                </button>
              )}
            </div>
          </div>
        </Field>

        {/* What this actually looks like on a results page. */}
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Search preview
          </p>
          <p className="truncate text-[15px] text-[#1a0dab]">{previewTitle}</p>
          <p className="truncate text-xs text-[#006621]">/{form.slug}</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">
            {form.seoDescription || "No description yet — search engines will pick their own text."}
          </p>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={pending} className={secondaryButton}>
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={pending || form.title.trim().length < 2 || form.slug.trim().length < 1}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save settings
          </button>
        </div>
      </div>

      <MediaPicker
        open={picking}
        onClose={() => setPicking(false)}
        onSelect={(media) => {
          set("ogImage")(media.url);
          setPicking(false);
        }}
      />
    </div>,
    document.body,
  );
}

const input =
  "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

const secondaryButton =
  "inline-flex h-10 items-center rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50";

function Field({
  label,
  htmlFor,
  help,
  warn,
  children,
}: {
  label: string;
  htmlFor?: string;
  help?: string;
  warn?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {help && (
        <p className={`mt-1.5 text-xs ${warn ? "text-amber-600" : "text-slate-500"}`}>{help}</p>
      )}
    </div>
  );
}
