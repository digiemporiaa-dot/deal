"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CornerDownLeft, Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SearchHit } from "@/app/api/admin/search/route";

/**
 * Ctrl/⌘ + K search.
 *
 * Searches records on the server and navigation locally, because the pages a
 * user can reach are already known on the client and a round trip to match
 * "settings" would be silly. Server results are permission-filtered by the
 * route; the nav list passed in is already filtered by role.
 *
 * Typing is debounced and every response carries the query it answered, so a
 * slow early response cannot overwrite the results of a later one.
 */

const DEBOUNCE_MS = 180;
const MIN_QUERY = 2;

export type NavShortcut = { label: string; href: string; group: string };

type Row = { id: string; group: string; title: string; subtitle: string; href: string };

export function CommandPalette({
  open,
  onClose,
  shortcuts,
}: {
  open: boolean;
  onClose: () => void;
  shortcuts: NavShortcut[];
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<SearchHit[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const [failed, setFailed] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  // Reset on close so reopening never shows the previous search.
  React.useEffect(() => {
    if (open) {
      setQuery("");
      setHits([]);
      setActive(0);
      setFailed(false);
      // Focus after the portal paints.
      const timer = window.setTimeout(() => inputRef.current?.focus(), 10);
      return () => window.clearTimeout(timer);
    }
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Fetch, debounced and race-safe.
  React.useEffect(() => {
    const term = query.trim();
    if (!open || term.length < MIN_QUERY) {
      setHits([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setFailed(false);

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/admin/search?q=${encodeURIComponent(term)}`);
        if (cancelled) return;
        if (!response.ok) throw new Error("search failed");
        const data = (await response.json()) as { hits: SearchHit[] };
        if (cancelled) return;
        setHits(data.hits ?? []);
      } catch {
        if (!cancelled) {
          setHits([]);
          setFailed(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, open]);

  // Navigation matches are local, so they appear instantly while records load.
  const navMatches: Row[] = React.useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return shortcuts
      .filter((item) => item.label.toLowerCase().includes(term) || item.group.toLowerCase().includes(term))
      .slice(0, 5)
      .map((item) => ({
        id: `nav-${item.href}`,
        group: "Go to",
        title: item.label,
        subtitle: item.group,
        href: item.href,
      }));
  }, [query, shortcuts]);

  const rows: Row[] = React.useMemo(() => [...navMatches, ...hits], [navMatches, hits]);

  React.useEffect(() => setActive(0), [rows.length]);

  const go = React.useCallback(
    (href: string) => {
      onClose();
      router.push(href);
    },
    [onClose, router],
  );

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (rows.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => (index + 1) % rows.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => (index - 1 + rows.length) % rows.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const row = rows[active];
      if (row) go(row.href);
    }
  };

  // Keep the highlighted row in view when arrowing past the fold.
  React.useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  const grouped = rows.reduce<[string, Row[]][]>((groups, row) => {
    const last = groups[groups.length - 1];
    if (last && last[0] === row.group) last[1].push(row);
    else groups.push([row.group, [row]]);
    return groups;
  }, []);

  const term = query.trim();
  let index = -1;

  return (
    <div
      className="fixed inset-0 z-[140] flex items-start justify-center p-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Search"
    >
      <div className="admin-animate-overlay fixed inset-0 bg-slate-900/50" onClick={onClose} aria-hidden />

      <div
        className="admin-animate-pop relative flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-card border border-admin bg-admin-card shadow-2xl"
        onKeyDown={onKeyDown}
      >
        <div className="flex shrink-0 items-center gap-2.5 border-b border-admin px-4">
          <Search className="h-4 w-4 shrink-0 text-admin-text-subtle" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search leads, customers, bookings, packages…"
            aria-label="Search"
            role="combobox"
            aria-expanded
            aria-controls="command-results"
            className="h-12 w-full bg-transparent text-sm text-admin-text placeholder:text-admin-text-subtle focus:outline-none"
          />
          {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-admin-text-subtle" />}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="admin-focus shrink-0 rounded p-1 text-admin-text-subtle hover:bg-admin-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div ref={listRef} id="command-results" role="listbox" className="admin-scroll min-h-0 flex-1 overflow-y-auto p-2">
          {term.length < MIN_QUERY ? (
            <p className="px-3 py-8 text-center text-sm text-admin-text-subtle">
              Type at least {MIN_QUERY} characters to search.
            </p>
          ) : failed ? (
            <p className="px-3 py-8 text-center text-sm text-admin-text-muted">
              Search is unavailable right now. Try again in a moment.
            </p>
          ) : rows.length === 0 && !loading ? (
            <p className="px-3 py-8 text-center text-sm text-admin-text-subtle">
              Nothing matched “{term}”.
            </p>
          ) : (
            grouped.map(([group, groupRows]) => (
              <div key={group} className="mb-2 last:mb-0">
                <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-admin-text-subtle">
                  {group}
                </p>
                {groupRows.map((row) => {
                  index += 1;
                  const isActive = index === active;
                  const rowIndex = index;
                  return (
                    <button
                      key={row.id}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      data-active={isActive}
                      onMouseEnter={() => setActive(rowIndex)}
                      onClick={() => go(row.href)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-control px-3 py-2 text-left",
                        isActive ? "bg-brand-50 text-brand-900" : "hover:bg-admin-muted",
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-admin-text">
                          {row.title}
                        </span>
                        {row.subtitle && (
                          <span className="block truncate text-[11px] text-admin-text-muted">
                            {row.subtitle}
                          </span>
                        )}
                      </span>
                      <ArrowRight
                        className={cn("h-3.5 w-3.5 shrink-0", isActive ? "text-brand-600" : "text-transparent")}
                        aria-hidden
                      />
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="flex shrink-0 items-center gap-3 border-t border-admin bg-admin-bg px-4 py-2 text-[11px] text-admin-text-subtle">
          <span className="flex items-center gap-1">
            <Key>↑</Key>
            <Key>↓</Key>
            to navigate
          </span>
          <span className="flex items-center gap-1">
            <Key>
              <CornerDownLeft className="h-2.5 w-2.5" />
            </Key>
            to open
          </span>
          <span className="ml-auto flex items-center gap-1">
            <Key>esc</Key>
            to close
          </span>
        </div>
      </div>
    </div>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-4 min-w-4 items-center justify-center rounded border border-admin bg-admin-card px-1 font-sans text-[10px] text-admin-text-muted">
      {children}
    </kbd>
  );
}
