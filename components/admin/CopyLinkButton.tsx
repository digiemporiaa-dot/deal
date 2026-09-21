"use client";

import * as React from "react";
import { Check, Link2 } from "lucide-react";
import { buttonClasses } from "@/components/admin/ui";

/**
 * A permalink you can actually take somewhere.
 *
 * The booking drawer had one of these as a plain link, and it pointed at the
 * address already in the bar — the drawer writes its own id into the URL when
 * it opens, so the link's target and the current page were the same thing.
 * Clicking did nothing at all, under an icon that promised a new tab.
 *
 * What someone wants from a permalink is the address itself, to paste into a
 * message, so a plain click copies it. It stays an anchor with a real href,
 * which keeps everything a link normally gives you: ctrl or middle click
 * opens it in a new tab, and the context menu can copy it too. Only the
 * unmodified click is taken over.
 */
export function CopyLinkButton({
  path,
  label = "Copy link",
  copiedLabel = "Link copied",
  className,
}: {
  /** Root-relative, e.g. `/admin/bookings?booking=abc`. */
  path: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const confirm = () => {
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  };

  const copy = async (event: React.MouseEvent<HTMLAnchorElement>) => {
    // Leave the browser's own behaviour alone for a deliberate new-tab click.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();

    const url = new URL(path, window.location.origin).toString();

    try {
      // Only available over https or on localhost; a VPS served over plain
      // http would otherwise throw here rather than copy.
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        confirm();
        return;
      }
      throw new Error("clipboard unavailable");
    } catch {
      // Fall back to a selection-based copy, which needs no secure context.
      const field = document.createElement("textarea");
      field.value = url;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
      document.body.removeChild(field);
      // If even that fails there is nothing sensible left but to follow the
      // link, so the address is at least in the bar to copy by hand.
      if (ok) confirm();
      else window.location.href = url;
    }
  };

  return (
    <a
      href={path}
      onClick={copy}
      title="Copy a link to this record — ctrl-click to open it in a new tab"
      className={className ?? buttonClasses("ghost", "sm")}
    >
      {copied ? copiedLabel : label}
      {copied ? (
        <Check className="h-3.5 w-3.5 text-admin-success" />
      ) : (
        <Link2 className="h-3.5 w-3.5" />
      )}
    </a>
  );
}
