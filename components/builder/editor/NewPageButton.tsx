"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Loader2, Plus, X } from "lucide-react";
import { useToast } from "@/components/admin/Toast";
import { createBuilderPage } from "@/app/admin/(panel)/pages/builder-actions";

/**
 * Creates a page and goes straight into the builder.
 *
 * A template is optional: an empty page opens on the "start building" state,
 * which is the shorter path for someone who knows what they want.
 */
export function NewPageButton({
  templates,
}: {
  templates: { slug: string; name: string; description: string | null }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [template, setTemplate] = React.useState("");
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && !pending && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, pending]);

  const create = async () => {
    setPending(true);
    try {
      const result = await createBuilderPage({ title, template: template || undefined });
      if (result.ok) {
        toast.success("Page created.");
        router.push(`/admin/pages/${result.id}/builder`);
      } else {
        toast.error(result.error);
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
      >
        <Plus className="h-4 w-4" /> New page
      </button>

      {mounted &&
        open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-page-title"
            className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/50 p-4"
            onClick={() => !pending && setOpen(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl bg-white p-6"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex items-start justify-between">
                <h2 id="new-page-title" className="font-semibold text-slate-900">
                  Create a page
                </h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="rounded p-1 text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="page-title">
                Page title
              </label>
              <input
                id="page-title"
                value={title}
                autoFocus
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Kashmir Holiday Packages"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
              <p className="mt-1.5 text-xs text-slate-500">
                The URL is generated from the title, and can be changed later.
              </p>

              {templates.length > 0 && (
                <>
                  <label
                    className="mb-1.5 mt-4 block text-sm font-medium text-slate-700"
                    htmlFor="page-template"
                  >
                    Start from
                  </label>
                  <select
                    id="page-template"
                    value={template}
                    onChange={(event) => setTemplate(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
                  >
                    <option value="">A blank page</option>
                    {templates.map((item) => (
                      <option key={item.slug} value={item.slug}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </>
              )}

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                  className="inline-flex h-10 items-center rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={create}
                  disabled={pending || title.trim().length < 2}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create and build
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
