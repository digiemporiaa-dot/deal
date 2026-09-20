"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Drawer and Modal — the two overlay shapes the admin panel uses.
 *
 * They share one set of dialog mechanics because getting them right twice is
 * how they end up subtly different: Escape closes, the background scroll is
 * locked, focus moves in and is trapped, and focus returns to whatever opened
 * it. Both render through a portal so a parent's `overflow` or stacking
 * context cannot clip them.
 *
 * Which to use (§43/§44): a drawer for looking at a record without losing the
 * list behind it; a modal for a short create/confirm. Neither is right for a
 * long workflow — that gets its own page.
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function useDialog(open: boolean, onClose: () => void, locked?: boolean) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const returnFocusRef = React.useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;

    returnFocusRef.current = document.activeElement as HTMLElement | null;

    // Move focus inside, preferring the first real control over the panel.
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();

    // Lock the page behind, compensating for the scrollbar so the layout
    // underneath does not jump sideways as it disappears.
    const { body, documentElement } = document;
    const gap = window.innerWidth - documentElement.clientWidth;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;
    body.style.overflow = "hidden";
    if (gap > 0) body.style.paddingRight = `${gap}px`;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !locked) {
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) return;

      // Trap Tab inside the dialog.
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (element) => element.offsetParent !== null,
      );
      if (items.length === 0) return;

      const firstItem = items[0]!;
      const lastItem = items[items.length - 1]!;
      const active = document.activeElement;

      if (event.shiftKey && active === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && active === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };

    document.addEventListener("keydown", onKey, true);

    return () => {
      document.removeEventListener("keydown", onKey, true);
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPadding;
      returnFocusRef.current?.focus?.();
    };
  }, [open, onClose, locked]);

  return { panelRef, mounted };
}

/* ───────────────────────────── drawer ───────────────────────────── */

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  header,
  footer,
  width = "md",
  children,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  /** Used as the accessible name when `header` is supplied too. */
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Replaces the default title block — for an avatar + actions header. */
  header?: React.ReactNode;
  footer?: React.ReactNode;
  width?: "sm" | "md" | "lg";
  children: React.ReactNode;
  /** Blocks Escape and the backdrop while something is saving. */
  busy?: boolean;
}) {
  const { panelRef, mounted } = useDialog(open, onClose, busy);
  const titleId = React.useId();

  if (!mounted || !open) return null;

  // Full-bleed on a phone, a panel from 640px up. The panel stays under
  // ~560px so the list behind it is still readable — a drawer that covers
  // half the screen may as well have been a page.
  const widths = {
    sm: "sm:max-w-[420px]",
    md: "sm:max-w-[480px]",
    lg: "sm:max-w-[560px]",
  };

  return createPortal(
    <div className="fixed inset-0 z-[120] flex justify-end" role="presentation">
      {/* The list stays visible behind a drawer — that is the point of one. */}
      <div
        className="admin-animate-overlay absolute inset-0 bg-admin-navy/40 backdrop-blur-[1px]"
        onClick={() => !busy && onClose()}
        aria-hidden
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "admin-animate-drawer relative flex h-full w-full flex-col bg-admin-card shadow-2xl outline-none",
          // Full-screen on a phone, a panel from 640px up (§45).
          widths[width],
        )}
      >
        <div className="flex items-start gap-3 border-b border-admin px-5 py-4">
          <div className="min-w-0 flex-1">
            {header ?? (
              <>
                <h2 id={titleId} className="truncate font-display text-lg font-bold text-admin-text">
                  {title}
                </h2>
                {subtitle && <p className="mt-0.5 truncate text-sm text-admin-text-muted">{subtitle}</p>}
              </>
            )}
            {header && (
              <span id={titleId} className="sr-only">
                {typeof title === "string" ? title : "Details"}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="admin-focus -mr-1 shrink-0 rounded-control p-1.5 text-admin-text-subtle hover:bg-admin-muted hover:text-admin-text"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="admin-scroll min-h-0 flex-1 overflow-y-auto">{children}</div>

        {footer && <div className="border-t border-admin bg-admin-bg px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* ───────────────────────────── modal ───────────────────────────── */

export function Modal({
  open,
  onClose,
  title,
  description,
  footer,
  children,
  size = "md",
  busy,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  busy?: boolean;
}) {
  const { panelRef, mounted } = useDialog(open, onClose, busy);
  const titleId = React.useId();

  if (!mounted || !open) return null;

  const sizes = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-xl" };

  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-end justify-center overflow-y-auto p-0 sm:items-center sm:p-4">
      <div
        className="admin-animate-overlay fixed inset-0 bg-admin-navy/50"
        onClick={() => !busy && onClose()}
        aria-hidden
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "admin-animate-pop relative w-full rounded-t-card bg-admin-card p-5 shadow-2xl outline-none sm:rounded-card",
          sizes[size],
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={titleId} className="font-semibold text-admin-text">
              {title}
            </h2>
            {description && <p className="mt-1 text-sm text-admin-text-muted">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="admin-focus -mr-1 -mt-1 shrink-0 rounded-control p-1.5 text-admin-text-subtle hover:bg-admin-muted hover:text-admin-text"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {children}

        {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
