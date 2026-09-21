"use client";

import * as React from "react";
import { ImageIcon, X } from "lucide-react";
import { MediaPicker, type PickedMedia } from "@/components/builder/editor/MediaPicker";
import { controlClasses } from "@/components/ui/Field";

/**
 * An image field for the admin forms.
 *
 * The forms used to offer a bare "image URL" box, which meant the only way to
 * put a picture on a package or a destination was to paste a link to somebody
 * else's server. Nothing was stored on this machine, so the site depended on
 * a third party staying up and not rewriting its URLs.
 *
 * This wires the same media library the page builder already uses into those
 * forms: choosing or uploading an image here stores the bytes wherever
 * STORAGE_DRIVER points — the VPS's own disk by default — and the field
 * records that local URL.
 *
 * The text box stays editable on purpose. Existing content holds remote URLs
 * and must keep working, and pasting a link is still occasionally the fastest
 * thing to do.
 */
export function ImageInput({
  value,
  onChange,
  onPicked,
  folder = "general",
  placeholder = "/uploads/… or https://…",
  id,
}: {
  value: string;
  onChange: (url: string) => void;
  /** Also receives alt text and dimensions, for forms that can use them. */
  onPicked?: (media: PickedMedia) => void;
  /** Library folder new uploads are filed under. */
  folder?: string;
  placeholder?: string;
  id?: string;
}) {
  const [picking, setPicking] = React.useState(false);

  return (
    <div>
      <div className="flex gap-2">
        <input
          id={id}
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={controlClasses("md", "min-w-0 flex-1")}
        />
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ImageIcon className="h-4 w-4" />
          Library
        </button>
      </div>

      {value ? (
        <div className="relative mt-2 inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element --
              the value may point at any host, which next/image cannot serve
              without that host being configured first. */}
          <img
            src={value}
            alt=""
            className="h-24 w-40 rounded-lg border border-slate-200 bg-slate-50 object-cover"
          />
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Remove image"
            className="absolute -right-2 -top-2 rounded-full border border-slate-300 bg-white p-1 text-slate-600 shadow-sm hover:bg-red-50 hover:text-red-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      <MediaPicker
        open={picking}
        onClose={() => setPicking(false)}
        folder={folder}
        onSelect={(media) => {
          onChange(media.url);
          onPicked?.(media);
        }}
      />
    </div>
  );
}
