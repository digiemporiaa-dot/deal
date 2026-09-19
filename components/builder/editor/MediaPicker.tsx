"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { ImageIcon, Loader2, Search, Upload, X, AlertTriangle } from "lucide-react";

/**
 * Media library picker.
 *
 * Reads the same `/api/media` endpoints the media library page uses, so there
 * is one library and one upload path. Choosing an image returns its URL, alt
 * text and real dimensions, which is what lets the image element reserve
 * space and avoid layout shift.
 */

export type PickedMedia = {
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
};

type MediaRow = {
  id: string;
  url: string;
  filename: string;
  originalFilename: string | null;
  alt: string | null;
  width: number | null;
  height: number | null;
  folder: string;
};

export function MediaPicker({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (media: PickedMedia) => void;
}) {
  const [items, setItems] = React.useState<MediaRow[]>([]);
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [mounted, setMounted] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => setMounted(true), []);

  const load = React.useCallback(async (search: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ perPage: "60" });
      if (search) params.set("q", search);
      const response = await fetch(`/api/media?${params.toString()}`);
      const data = await response.json();
      if (data.ok) setItems(data.media);
      else setError(data.error || "Could not load the media library.");
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (open) void load("");
  }, [open, load]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Debounce search so typing does not fire a request per keystroke.
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSearch = (value: string) => {
    setQuery(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void load(value), 300);
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", files[0]!);
      form.append("folder", "pages");
      const response = await fetch("/api/media", { method: "POST", body: form });
      const data = await response.json();
      if (data.ok) {
        setItems((current) => [data.media, ...current]);
      } else {
        setError(data.error || "Upload failed.");
      }
    } catch {
      setError("Upload failed.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  if (!mounted || !open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Choose an image"
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-2xl bg-white"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-slate-200 p-4">
          <h2 className="font-semibold text-slate-900">Media library</h2>
          <div className="relative ml-auto w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Search images"
              className="h-9 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Upload
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            className="hidden"
            onChange={(event) => void upload(event.target.files)}
          />
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1.5 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <p className="flex items-center gap-2 border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4" /> {error}
          </p>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {Array.from({ length: 10 }).map((_, index) => (
                <div key={index} className="aspect-square animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="grid place-items-center py-16 text-center">
              <ImageIcon className="h-8 w-8 text-slate-300" />
              <p className="mt-3 font-medium text-slate-900">No images found</p>
              <p className="mt-1 text-sm text-slate-500">Upload one to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelect({
                      url: item.url,
                      alt: item.alt ?? "",
                      width: item.width,
                      height: item.height,
                    });
                    onClose();
                  }}
                  className="group overflow-hidden rounded-lg border border-slate-200 text-left hover:border-brand-500"
                >
                  <span className="relative block aspect-square bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element --
                        the library holds arbitrary hosts; see components/builder/views.tsx */}
                    <img
                      src={item.url}
                      alt={item.alt || item.filename}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                    {!item.alt && (
                      <span className="absolute left-1 top-1 rounded bg-amber-500/90 px-1 text-[9px] font-semibold text-white">
                        No alt
                      </span>
                    )}
                  </span>
                  <span className="block truncate px-2 py-1 text-[11px] text-slate-600">
                    {item.originalFilename || item.filename}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
