"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { HelpCircle, Menu as MenuIcon, Plus, RefreshCw, Search } from "lucide-react";
import { Breadcrumbs } from "@/components/admin/ui";
import { Menu, MenuItem, MenuLabel, MenuSeparator } from "@/components/admin/Menu";
import { breadcrumbsFor } from "@/lib/admin-nav";
import { cn } from "@/lib/utils";

/**
 * Topbar.
 *
 * Breadcrumbs on the left, then the search trigger, then the actions that
 * apply anywhere: create something, get help, refresh. Page-specific actions
 * belong in that page's header, not up here — otherwise the bar becomes a
 * dumping ground and nothing in it is findable.
 */

export type QuickCreateItem = { label: string; href: string; group: string };

export function Topbar({
  onOpenNav,
  onOpenSearch,
  quickCreate,
}: {
  onOpenNav: () => void;
  onOpenSearch: () => void;
  quickCreate: QuickCreateItem[];
}) {
  const pathname = usePathname();
  const crumbs = React.useMemo(() => breadcrumbsFor(pathname), [pathname]);
  const [isMac, setIsMac] = React.useState(false);

  // Shown only after mount: the server cannot know the platform, and
  // rendering the wrong modifier key then swapping it is worse than a blank.
  React.useEffect(() => {
    setIsMac(/mac/i.test(navigator.platform));
  }, []);

  const groups = React.useMemo(() => {
    const map = new Map<string, QuickCreateItem[]>();
    for (const item of quickCreate) {
      const list = map.get(item.group) ?? [];
      list.push(item);
      map.set(item.group, list);
    }
    return [...map.entries()];
  }, [quickCreate]);

  return (
    <header className="sticky top-0 z-30 flex h-[60px] shrink-0 items-center gap-2 border-b border-admin bg-admin-card/95 px-3 backdrop-blur sm:px-5">
      <button
        type="button"
        onClick={onOpenNav}
        aria-label="Open navigation"
        className="admin-focus rounded-control p-2 text-admin-text-muted hover:bg-admin-muted lg:hidden"
      >
        <MenuIcon className="h-5 w-5" />
      </button>

      <div className="hidden min-w-0 flex-1 md:block">
        <Breadcrumbs items={crumbs} />
      </div>

      {/* Search. Full width on small screens, where breadcrumbs are hidden. */}
      <button
        type="button"
        onClick={onOpenSearch}
        className={cn(
          "admin-focus group flex h-9 items-center gap-2 rounded-control border border-admin bg-admin-bg px-3 text-sm text-admin-text-subtle transition-colors hover:border-admin-border-strong hover:text-admin-text-muted",
          "min-w-0 flex-1 md:ml-auto md:w-64 md:flex-none xl:w-80",
        )}
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="truncate">Search anything…</span>
        <kbd className="ml-auto hidden shrink-0 rounded border border-admin bg-admin-card px-1.5 font-sans text-[10px] font-medium text-admin-text-subtle sm:block">
          {isMac ? "⌘K" : "Ctrl K"}
        </kbd>
      </button>

      <div className="flex shrink-0 items-center gap-1">
        {groups.length > 0 && (
          <Menu
            label="Create new"
            align="right"
            width="w-56"
            trigger={
              <span className="inline-flex h-9 items-center gap-1.5 rounded-control bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Create</span>
              </span>
            }
          >
            {groups.map(([group, items], index) => (
              <React.Fragment key={group}>
                {index > 0 && <MenuSeparator />}
                <MenuLabel>{group}</MenuLabel>
                {items.map((item) => (
                  <MenuItem key={item.href} href={item.href}>
                    {item.label}
                  </MenuItem>
                ))}
              </React.Fragment>
            ))}
          </Menu>
        )}

        <button
          type="button"
          onClick={() => window.location.reload()}
          aria-label="Refresh this page"
          title="Refresh"
          className="admin-focus hidden rounded-control p-2 text-admin-text-muted hover:bg-admin-muted hover:text-admin-text sm:block"
        >
          <RefreshCw className="h-4 w-4" />
        </button>

        <a
          href="/admin/settings"
          aria-label="Help and support"
          title="Help & support"
          className="admin-focus hidden rounded-control p-2 text-admin-text-muted hover:bg-admin-muted hover:text-admin-text sm:block"
        >
          <HelpCircle className="h-4 w-4" />
        </a>
      </div>
    </header>
  );
}
