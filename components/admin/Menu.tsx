"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Dropdown menu.
 *
 * Follows the menu button pattern: the trigger owns `aria-expanded` and
 * `aria-haspopup`, the list is a `menu`, and arrow keys move between items so
 * the control is usable without a pointer. Closes on Escape, on an outside
 * click, and after an item is chosen.
 *
 * Positioned with absolute placement rather than a floating library — admin
 * menus hang off the top-right of a control, and a 2 kB dependency to handle
 * collision cases that do not arise is not worth the bundle.
 */

type MenuContext = { close: () => void };
const Ctx = React.createContext<MenuContext>({ close: () => {} });

export function Menu({
  trigger,
  children,
  align = "right",
  width = "w-52",
  label = "Open menu",
}: {
  /** Rendered inside the trigger button. */
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "left" | "right";
  width?: string;
  label?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const close = React.useCallback(() => setOpen(false), []);

  React.useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        rootRef.current?.querySelector("button")?.focus();
        return;
      }

      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;

      const items = Array.from(
        listRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [],
      );
      if (items.length === 0) return;

      event.preventDefault();
      const index = items.indexOf(document.activeElement as HTMLElement);
      const next =
        event.key === "ArrowDown"
          ? items[(index + 1) % items.length]
          : items[(index - 1 + items.length) % items.length];
      next?.focus();
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
        className="admin-focus inline-flex items-center rounded-control"
      >
        {trigger}
      </button>

      {open && (
        <div
          ref={listRef}
          role="menu"
          className={cn(
            "admin-animate-pop absolute z-50 mt-1.5 overflow-hidden rounded-card border border-admin bg-admin-card py-1 shadow-lg",
            width,
            align === "right" ? "right-0" : "left-0",
          )}
        >
          <Ctx.Provider value={{ close }}>{children}</Ctx.Provider>
        </div>
      )}
    </div>
  );
}

const ITEM_CLASSES =
  "admin-focus flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] font-medium text-admin-text-muted hover:bg-admin-muted hover:text-admin-text disabled:cursor-not-allowed disabled:opacity-50";

export function MenuItem({
  children,
  onClick,
  href,
  tone,
  disabled,
  icon,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  tone?: "danger";
  disabled?: boolean;
  icon?: React.ReactNode;
}) {
  const { close } = React.useContext(Ctx);
  const classes = cn(ITEM_CLASSES, tone === "danger" && "text-admin-danger hover:bg-red-50 hover:text-red-700");

  if (href) {
    return (
      <Link role="menuitem" href={href} onClick={close} className={classes}>
        {icon}
        {children}
      </Link>
    );
  }

  return (
    <button
      role="menuitem"
      type="button"
      disabled={disabled}
      onClick={() => {
        close();
        onClick?.();
      }}
      className={classes}
    >
      {icon}
      {children}
    </button>
  );
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-admin-text-subtle">
      {children}
    </p>
  );
}

export function MenuSeparator() {
  return <hr className="my-1 border-admin" />;
}
