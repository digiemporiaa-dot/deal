"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/admin/Sidebar";
import { Topbar, type QuickCreateItem } from "@/components/admin/Topbar";
import { CommandPalette, type NavShortcut } from "@/components/admin/CommandPalette";
import { cn } from "@/lib/utils";

/**
 * The persistent admin shell: sidebar, topbar, and the page beneath them.
 *
 * This is the only client component wrapping the panel. It holds nothing but
 * chrome state — which overlays are open, how wide the rail is — so every
 * page inside it stays a Server Component and keeps rendering its data on the
 * server (§52).
 */

export function AdminShell({
  userName,
  userEmail,
  userRole,
  quickCreate,
  shortcuts,
  children,
}: {
  userName: string;
  userEmail: string;
  userRole: string;
  quickCreate: QuickCreateItem[];
  shortcuts: NavShortcut[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);

  // A navigation always closes the mobile drawer; leaving it open over the
  // page someone just chose is the classic mobile-nav bug.
  React.useEffect(() => setNavOpen(false), [pathname]);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const closeNav = React.useCallback(() => setNavOpen(false), []);

  return (
    <div className="min-h-screen bg-admin-bg">
      <Sidebar
        userName={userName}
        userEmail={userEmail}
        userRole={userRole}
        mobileOpen={navOpen}
        onMobileClose={closeNav}
        onCollapsedChange={setCollapsed}
      />

      {/* The main column is pushed by the rail's width on desktop only; on
          smaller screens the sidebar is an overlay and takes no space. */}
      <div
        className={cn(
          "flex min-h-screen min-w-0 flex-col transition-[padding] duration-200",
          collapsed ? "lg:pl-[72px]" : "lg:pl-[264px]",
        )}
      >
        <Topbar
          onOpenNav={() => setNavOpen(true)}
          onOpenSearch={() => setSearchOpen(true)}
          quickCreate={quickCreate}
        />

        <main id="admin-main" className="min-w-0 flex-1 p-4 sm:p-5 lg:p-6">
          <div className="mx-auto w-full max-w-[1600px]">{children}</div>
        </main>
      </div>

      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} shortcuts={shortcuts} />
    </div>
  );
}
