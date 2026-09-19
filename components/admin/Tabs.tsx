"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Tabs for long forms (the package editor) and detail drawers.
 *
 * Implements the tab pattern properly: arrow keys move between tabs, only the
 * active tab is in the tab order, and each panel is labelled by its tab.
 * Inactive panels stay mounted but hidden, so a half-filled form field is not
 * lost by switching tabs to check something.
 */

export type TabItem = {
  id: string;
  label: React.ReactNode;
  /** Small count or dot after the label. */
  badge?: React.ReactNode;
  content: React.ReactNode;
};

export function Tabs({
  items,
  defaultTab,
  className,
  onChange,
}: {
  items: TabItem[];
  defaultTab?: string;
  className?: string;
  onChange?: (id: string) => void;
}) {
  const [active, setActive] = React.useState(defaultTab ?? items[0]?.id ?? "");
  const listRef = React.useRef<HTMLDivElement>(null);
  const baseId = React.useId();

  const select = (id: string) => {
    setActive(id);
    onChange?.(id);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();

    const index = items.findIndex((item) => item.id === active);
    const next =
      event.key === "ArrowRight"
        ? items[(index + 1) % items.length]
        : event.key === "ArrowLeft"
          ? items[(index - 1 + items.length) % items.length]
          : event.key === "Home"
            ? items[0]
            : items[items.length - 1];

    if (!next) return;
    select(next.id);
    listRef.current?.querySelector<HTMLElement>(`#${CSS.escape(`${baseId}-tab-${next.id}`)}`)?.focus();
  };

  return (
    <div className={className}>
      <div
        ref={listRef}
        role="tablist"
        onKeyDown={onKeyDown}
        className="admin-scroll -mb-px flex gap-1 overflow-x-auto border-b border-admin"
      >
        {items.map((item) => {
          const selected = item.id === active;
          return (
            <button
              key={item.id}
              id={`${baseId}-tab-${item.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(item.id)}
              className={cn(
                "admin-focus flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors",
                selected
                  ? "border-brand-600 text-brand-700"
                  : "border-transparent text-admin-text-muted hover:text-admin-text",
              )}
            >
              {item.label}
              {item.badge}
            </button>
          );
        })}
      </div>

      {items.map((item) => (
        <div
          key={item.id}
          id={`${baseId}-panel-${item.id}`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${item.id}`}
          hidden={item.id !== active}
          className="pt-5"
        >
          {item.content}
        </div>
      ))}
    </div>
  );
}
