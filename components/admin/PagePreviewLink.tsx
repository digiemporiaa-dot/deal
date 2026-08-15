"use client";

import { Eye } from "lucide-react";

/**
 * Opens the live page with ?preview=1 so an admin can see a DRAFT
 * exactly as visitors will, before publishing it.
 */
export function PagePreviewLink({ slug }: { slug?: string }) {
  const clean = (slug || "").trim().replace(/^\/+/, "");
  if (!clean) {
    return (
      <p className="text-xs text-slate-400">
        Enter a slug and save the page to enable preview.
      </p>
    );
  }
  return (
    <a
      href={`/${clean}?preview=1`}
      target="_blank"
      rel="noreferrer"
      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50"
    >
      <Eye className="h-4 w-4" /> Preview this page
    </a>
  );
}
