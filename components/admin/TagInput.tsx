"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Tag entry.
 *
 * Enter or comma commits a tag, Backspace on an empty box removes the last
 * one — the shortcuts people already expect from every other tag field they
 * have used. De-duplication is case-insensitive here so the UI does not offer
 * to add a tag it will then silently merge; the server normalises again
 * regardless, because this is a convenience, not a validation.
 */
export function TagInput({
  value,
  onChange,
  disabled,
  suggestions = [],
  placeholder = "Add a tag…",
  max = 20,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
  suggestions?: string[];
  placeholder?: string;
  max?: number;
}) {
  const [draft, setDraft] = React.useState("");

  const has = (tag: string) => value.some((t) => t.toLowerCase() === tag.toLowerCase());

  const add = (raw: string) => {
    const tag = raw.trim().slice(0, 40);
    if (!tag || has(tag) || value.length >= max) {
      setDraft("");
      return;
    }
    onChange([...value, tag]);
    setDraft("");
  };

  const remove = (tag: string) => onChange(value.filter((t) => t !== tag));

  const unused = suggestions.filter((tag) => !has(tag)).slice(0, 8);

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "flex flex-wrap items-center gap-1.5 rounded-control border border-admin-border-strong bg-admin-card px-2 py-1.5",
          "focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500",
          disabled && "opacity-60",
        )}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 ring-1 ring-brand-200"
          >
            {tag}
            <button
              type="button"
              disabled={disabled}
              onClick={() => remove(tag)}
              aria-label={`Remove tag ${tag}`}
              className="rounded-full p-0.5 hover:bg-brand-100 disabled:cursor-not-allowed"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}

        <input
          type="text"
          value={draft}
          disabled={disabled || value.length >= max}
          placeholder={value.length >= max ? `Up to ${max} tags` : placeholder}
          aria-label="Add a tag"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              add(draft);
            } else if (event.key === "Backspace" && !draft && value.length > 0) {
              remove(value[value.length - 1]);
            }
          }}
          // Committed on blur too: a tag typed and left sitting in the box is
          // a tag the person meant to add.
          onBlur={() => add(draft)}
          className="min-w-[8rem] flex-1 border-0 bg-transparent p-0 text-sm text-admin-text outline-none placeholder:text-admin-text-subtle"
        />
      </div>

      {unused.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {unused.map((tag) => (
            <button
              key={tag}
              type="button"
              disabled={disabled}
              onClick={() => add(tag)}
              className="rounded-full border border-dashed border-admin-border-strong px-2 py-0.5 text-xs text-admin-text-muted hover:border-brand-400 hover:text-brand-700 disabled:opacity-50"
            >
              + {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
