"use client";

import * as React from "react";
import Image from "next/image";
import { Upload, Trash2, Copy, Check, Loader2 } from "lucide-react";

type Media = { id: string; url: string; filename: string; size: number };

export function MediaLibrary({ initial }: { initial: Media[] }) {
  const [items, setItems] = React.useState<Media[]>(initial);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/media", { method: "POST", body: fd });
      const data = await res.json();
      if (data.ok) setItems((prev) => [data.media, ...prev]);
      else setError(data.error || "Upload failed");
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this image?")) return;
    const res = await fetch(`/api/media/${id}`, { method: "DELETE" });
    if (res.ok) setItems((prev) => prev.filter((m) => m.id !== id));
  };

  const copy = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopied(url);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files); }}
        className="mb-6 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-8 text-center"
      >
        <Upload className="mx-auto h-8 w-8 text-slate-400" />
        <p className="mt-2 text-sm text-slate-600">Drag & drop images here, or</p>
        <button onClick={() => inputRef.current?.click()} className="mt-2 inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700" disabled={uploading}>
          {uploading ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</> : "Choose files"}
        </button>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
        <p className="mt-2 text-xs text-slate-400">JPG, PNG, WEBP, GIF, AVIF · up to 5MB each</p>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-500">No media yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {items.map((m) => (
            <div key={m.id} className="group overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="relative aspect-square bg-slate-100">
                <Image src={m.url} alt={m.filename} fill sizes="200px" className="object-cover" />
              </div>
              <div className="flex items-center justify-between gap-1 p-2">
                <button onClick={() => copy(m.url)} className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-slate-500 hover:bg-slate-100" title="Copy URL">
                  {copied === m.url ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
                <button onClick={() => remove(m.id)} className="rounded-md px-1.5 py-1 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
