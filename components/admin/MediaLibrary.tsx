"use client";

import * as React from "react";
import Image from "next/image";
import {
  Upload,
  Trash2,
  Copy,
  Check,
  Loader2,
  Search,
  X,
  Pencil,
  FolderOpen,
  AlertTriangle,
} from "lucide-react";
import { Input, Label, Select, Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/admin/Toast";
import { formatFileSize } from "@/lib/utils";

export type MediaItem = {
  id: string;
  url: string;
  filename: string;
  originalFilename: string | null;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  alt: string | null;
  title: string | null;
  caption: string | null;
  folder: string;
  createdAt: string;
};

type FolderCount = { folder: string; count: number };

type Props = {
  initial: MediaItem[];
  initialFolders: FolderCount[];
  initialTotal: number;
  perPage: number;
  canUpload: boolean;
  canEdit: boolean;
  canDelete: boolean;
  /** When set, clicking an image selects it instead of opening the editor. */
  onSelect?: (media: MediaItem) => void;
};

/**
 * Media library.
 *
 * Search, folders and pagination are server-side — the browser never holds the
 * whole library. Alt text is surfaced everywhere because an image without it
 * is invisible to search engines and to anyone using a screen reader; images
 * missing one are flagged in the grid.
 */
export function MediaLibrary({
  initial,
  initialFolders,
  initialTotal,
  perPage,
  canUpload,
  canEdit,
  canDelete,
  onSelect,
}: Props) {
  const toast = useToast();

  const [items, setItems] = React.useState<MediaItem[]>(initial);
  const [folders, setFolders] = React.useState<FolderCount[]>(initialFolders);
  const [total, setTotal] = React.useState(initialTotal);
  const [page, setPage] = React.useState(1);
  const [query, setQuery] = React.useState("");
  const [folder, setFolder] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [uploading, setUploading] = React.useState<{ done: number; total: number } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<MediaItem | null>(null);
  const [uploadFolder, setUploadFolder] = React.useState("general");

  const inputRef = React.useRef<HTMLInputElement>(null);
  const pageCount = Math.max(1, Math.ceil(total / perPage));

  const load = React.useCallback(
    async (next: { page?: number; q?: string; folder?: string }) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("page", String(next.page ?? page));
        params.set("perPage", String(perPage));
        if (next.q ?? query) params.set("q", next.q ?? query);
        if (next.folder ?? folder) params.set("folder", next.folder ?? folder);

        const response = await fetch(`/api/media?${params.toString()}`);
        const data = await response.json();
        if (!data.ok) {
          setError(data.error || "Could not load the media library.");
          return;
        }
        setItems(data.media);
        setTotal(data.total);
        setFolders(data.folders);
        setPage(data.page);
      } catch {
        setError("Could not reach the server. Check your connection and try again.");
      } finally {
        setLoading(false);
      }
    },
    [page, perPage, query, folder],
  );

  // Debounce the search so typing does not fire a request per keystroke.
  const searchTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSearchChange = (value: string) => {
    setQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => void load({ page: 1, q: value }), 350);
  };

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    setUploading({ done: 0, total: list.length });
    setError(null);

    let failures = 0;
    for (const [index, file] of list.entries()) {
      const form = new FormData();
      form.append("file", file);
      form.append("folder", uploadFolder);
      try {
        const response = await fetch("/api/media", { method: "POST", body: form });
        const data = await response.json();
        if (data.ok) {
          setItems((current) => [data.media, ...current]);
          setTotal((current) => current + 1);
        } else {
          failures += 1;
          setError(`${file.name}: ${data.error || "Upload failed"}`);
        }
      } catch {
        failures += 1;
        setError(`${file.name}: upload failed.`);
      }
      setUploading({ done: index + 1, total: list.length });
    }

    setUploading(null);
    if (inputRef.current) inputRef.current.value = "";
    const succeeded = list.length - failures;
    if (succeeded > 0) toast.success(`${succeeded} image${succeeded === 1 ? "" : "s"} uploaded.`);
    if (failures > 0) toast.error(`${failures} upload${failures === 1 ? "" : "s"} failed.`);
  };

  const remove = async (item: MediaItem) => {
    const response = await fetch(`/api/media/${item.id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({ ok: response.ok }));
    if (data.ok) {
      setItems((current) => current.filter((m) => m.id !== item.id));
      setTotal((current) => Math.max(0, current - 1));
      toast.success("Image deleted.");
    } else {
      toast.error(data.error || "Could not delete that image.");
    }
  };

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("Your browser blocked the clipboard. Copy the URL from the details panel.");
    }
  };

  const saveMeta = async (item: MediaItem, values: Partial<MediaItem>) => {
    const response = await fetch(`/api/media/${item.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        alt: values.alt ?? "",
        title: values.title ?? "",
        caption: values.caption ?? "",
        folder: values.folder ?? item.folder,
      }),
    });
    const data = await response.json();
    if (data.ok) {
      setItems((current) => current.map((m) => (m.id === item.id ? { ...m, ...data.media } : m)));
      setEditing(null);
      toast.success("Image details saved.");
    } else {
      toast.error(data.error || "Could not save those details.");
    }
  };

  return (
    <div>
      {canUpload && (
        <div
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            void upload(event.dataTransfer.files);
          }}
          className="mb-6 rounded-2xl border-2 border-dashed border-admin-border-strong bg-white p-8 text-center"
        >
          <Upload className="mx-auto h-8 w-8 text-admin-text-subtle" />
          <p className="mt-2 text-sm text-admin-text-muted">Drag and drop images here, or</p>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={Boolean(uploading)}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading {uploading.done}/{uploading.total}…
                </>
              ) : (
                "Choose files"
              )}
            </button>
            <div className="flex items-center gap-2">
              <span className="text-sm text-admin-text-muted">into folder</span>
              <Input
                value={uploadFolder}
                onChange={(event) => setUploadFolder(event.target.value)}
                className="h-10 w-36 py-0"
                placeholder="general"
              />
            </div>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            multiple
            className="hidden"
            onChange={(event) => void upload(event.target.files)}
          />
          <p className="mt-2 text-xs text-admin-text-subtle">
            JPG, PNG, WEBP, GIF or AVIF · up to 8MB each. The file type is checked from its
            contents, not its name.
          </p>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
      )}

      {/* Search and folders */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <Label htmlFor="media-search">Search</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-text-subtle" />
            <Input
              id="media-search"
              value={query}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="File name, alt text or caption"
              className="pl-9"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="media-folder">Folder</Label>
          <Select
            id="media-folder"
            value={folder}
            onChange={(event) => {
              setFolder(event.target.value);
              void load({ page: 1, folder: event.target.value });
            }}
          >
            <option value="">All folders</option>
            {folders.map((f) => (
              <option key={f.folder} value={f.folder}>
                {f.folder} ({f.count})
              </option>
            ))}
          </Select>
        </div>
        {(query || folder) && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setFolder("");
              void load({ page: 1, q: "", folder: "" });
            }}
            className="inline-flex h-10 items-center gap-1 rounded-lg border border-admin-border-strong bg-white px-3 text-sm font-medium text-admin-text hover:bg-admin-bg"
          >
            <X className="h-4 w-4" /> Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, index) => (
            <div key={index} className="aspect-square animate-pulse rounded-xl bg-admin-muted" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-admin-border-strong p-12 text-center">
          <FolderOpen className="mx-auto h-8 w-8 text-admin-text-subtle" />
          <p className="mt-3 font-medium text-admin-text">
            {query || folder ? "Nothing matches those filters" : "No media yet"}
          </p>
          <p className="mt-1 text-sm text-admin-text-muted">
            {query || folder
              ? "Try a different search term or folder."
              : "Upload your first image to start building the library."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {items.map((item) => (
            <div
              key={item.id}
              className="group overflow-hidden rounded-xl border border-admin bg-white"
            >
              <button
                type="button"
                onClick={() => (onSelect ? onSelect(item) : canEdit ? setEditing(item) : undefined)}
                className="relative block aspect-square w-full bg-admin-muted"
                title={onSelect ? "Use this image" : item.filename}
              >
                <Image
                  src={item.url}
                  alt={item.alt || item.filename}
                  fill
                  sizes="200px"
                  loading="lazy"
                  className="object-cover"
                />
                {!item.alt && (
                  <span
                    className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-semibold text-white"
                    title="This image has no alt text"
                  >
                    <AlertTriangle className="h-3 w-3" /> No alt
                  </span>
                )}
              </button>

              <div className="px-2 pb-2 pt-1.5">
                <p className="truncate text-xs font-medium text-admin-text" title={item.filename}>
                  {item.originalFilename || item.filename}
                </p>
                <p className="text-[11px] text-admin-text-subtle">
                  {item.width && item.height ? `${item.width}×${item.height} · ` : ""}
                  {formatFileSize(item.size)}
                </p>

                <div className="mt-1 flex items-center justify-between gap-1">
                  <button
                    type="button"
                    onClick={() => void copy(item.url)}
                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-admin-text-muted hover:bg-admin-muted"
                    title="Copy URL"
                  >
                    {copied === item.url ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => setEditing(item)}
                      className="rounded-md px-1.5 py-1 text-admin-text-subtle hover:bg-admin-muted hover:text-admin-text"
                      title="Edit details"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {canDelete && (
                    <DeleteMediaButton item={item} onConfirm={() => remove(item)} />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {pageCount > 1 && (
        <div className="mt-6 flex items-center justify-between gap-3">
          <p className="text-xs text-admin-text-muted">
            Page {page} of {pageCount} · {total} images
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => void load({ page: page - 1 })}
              className="inline-flex h-9 items-center rounded-lg border border-admin-border-strong bg-white px-3 text-sm font-medium text-admin-text hover:bg-admin-bg disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= pageCount || loading}
              onClick={() => void load({ page: page + 1 })}
              className="inline-flex h-9 items-center rounded-lg border border-admin-border-strong bg-white px-3 text-sm font-medium text-admin-text hover:bg-admin-bg disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {editing && (
        <MediaDetails
          item={editing}
          folders={folders}
          onClose={() => setEditing(null)}
          onSave={(values) => saveMeta(editing, values)}
        />
      )}
    </div>
  );
}

function DeleteMediaButton({
  item,
  onConfirm,
}: {
  item: MediaItem;
  onConfirm: () => Promise<void> | void;
}) {
  const [confirming, setConfirming] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-md px-1.5 py-1 text-admin-text-subtle hover:bg-red-50 hover:text-red-600"
        title={`Delete ${item.filename}`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    );
  }

  return (
    <span className="flex items-center gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          await onConfirm();
          setPending(false);
        }}
        className="rounded-md bg-red-600 px-1.5 py-1 text-[11px] font-semibold text-white hover:bg-red-700 disabled:opacity-60"
      >
        {pending ? "…" : "Delete"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="rounded-md px-1 py-1 text-[11px] text-admin-text-muted hover:text-admin-text"
      >
        No
      </button>
    </span>
  );
}

function MediaDetails({
  item,
  folders,
  onClose,
  onSave,
}: {
  item: MediaItem;
  folders: FolderCount[];
  onClose: () => void;
  onSave: (values: Partial<MediaItem>) => Promise<void>;
}) {
  const [alt, setAlt] = React.useState(item.alt ?? "");
  const [title, setTitle] = React.useState(item.title ?? "");
  const [caption, setCaption] = React.useState(item.caption ?? "");
  const [folder, setFolder] = React.useState(item.folder);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-admin-navy/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image details"
    >
      <div
        className="grid max-h-[90vh] w-full max-w-3xl grid-cols-1 overflow-y-auto rounded-2xl bg-white sm:grid-cols-2"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative aspect-square bg-admin-muted">
          <Image src={item.url} alt={alt || item.filename} fill sizes="400px" className="object-contain" />
        </div>

        <div className="p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate font-semibold text-admin-text">
                {item.originalFilename || item.filename}
              </h2>
              <p className="mt-0.5 text-xs text-admin-text-muted">
                {item.mimeType} · {formatFileSize(item.size)}
                {item.width && item.height ? ` · ${item.width}×${item.height}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-md p-1 text-admin-text-subtle hover:bg-admin-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <Label htmlFor="media-alt">
                Alt text <span className="text-red-500">*</span>
              </Label>
              <Input
                id="media-alt"
                value={alt}
                onChange={(event) => setAlt(event.target.value)}
                placeholder="Describe the image for search engines and screen readers"
              />
              {!alt && (
                <p className="mt-1 text-xs text-amber-600">
                  Without alt text this image is invisible to search engines and to anyone using a
                  screen reader.
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="media-title">Title</Label>
              <Input id="media-title" value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div>
              <Label htmlFor="media-caption">Caption</Label>
              <Textarea
                id="media-caption"
                rows={2}
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="media-folder-edit">Folder</Label>
              <Input
                id="media-folder-edit"
                value={folder}
                onChange={(event) => setFolder(event.target.value)}
                list="media-folder-options"
              />
              <datalist id="media-folder-options">
                {folders.map((f) => (
                  <option key={f.folder} value={f.folder} />
                ))}
              </datalist>
            </div>
            <div>
              <Label htmlFor="media-url">URL</Label>
              <Input id="media-url" readOnly value={item.url} onFocus={(e) => e.currentTarget.select()} />
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center rounded-lg border border-admin-border-strong bg-white px-4 text-sm font-semibold text-admin-text hover:bg-admin-bg"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                await onSave({ alt, title, caption, folder });
                setSaving(false);
              }}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Saving…" : "Save details"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
