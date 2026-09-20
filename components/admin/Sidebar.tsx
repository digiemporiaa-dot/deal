"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  Plane,
  Settings,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { navigationFor, isNavItemActive, type NavGroup } from "@/lib/admin-nav";
import { canAccessSection, roleLabel } from "@/lib/permissions";

/**
 * Dark navy sidebar.
 *
 * Two independent bits of state, deliberately separate:
 *  - `collapsed` — a desktop preference, remembered across visits.
 *  - `mobileOpen` — a transient overlay on small screens, never remembered.
 *
 * Collapsing is stored in localStorage rather than a cookie because it is a
 * per-device preference and nothing on the server needs to know it. The
 * initial render is the expanded layout; the stored value is applied on mount,
 * so the markup the server sends and the markup React first renders agree.
 */

const STORAGE_KEY = "vd-admin-sidebar-collapsed";
const GROUP_KEY = "vd-admin-sidebar-groups";

export function Sidebar({
  userName,
  userEmail,
  userRole,
  mobileOpen,
  onMobileClose,
  onCollapsedChange,
}: {
  userName: string;
  userEmail: string;
  userRole: string;
  mobileOpen: boolean;
  onMobileClose: () => void;
  onCollapsedChange: (collapsed: boolean) => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  const [collapsed, setCollapsed] = React.useState(false);
  const [closedGroups, setClosedGroups] = React.useState<string[]>([]);

  const groups = React.useMemo(() => navigationFor(userRole), [userRole]);

  React.useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "1");
      const stored = window.localStorage.getItem(GROUP_KEY);
      if (stored) setClosedGroups(JSON.parse(stored) as string[]);
    } catch {
      // Private mode or blocked storage — the defaults are fine.
    }
  }, []);

  React.useEffect(() => onCollapsedChange(collapsed), [collapsed, onCollapsedChange]);

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* not worth failing the click over */
      }
      return next;
    });
  };

  const toggleGroup = (id: string) => {
    setClosedGroups((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      try {
        window.localStorage.setItem(GROUP_KEY, JSON.stringify(next));
      } catch {
        /* as above */
      }
      return next;
    });
  };

  return (
    <>
      {/* Backdrop, mobile only. */}
      {mobileOpen && (
        <div
          className="admin-animate-overlay fixed inset-0 z-40 bg-slate-900/50 lg:hidden"
          onClick={onMobileClose}
          aria-hidden
        />
      )}

      <aside
        aria-label="Admin navigation"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col bg-admin-navy text-slate-300 transition-[width,transform] duration-200 lg:translate-x-0",
          collapsed ? "w-[72px]" : "w-[264px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Brand */}
        <div
          className={cn(
            "flex h-[60px] shrink-0 items-center gap-2.5 border-b border-admin-navy-line",
            collapsed ? "justify-center px-3" : "px-4",
          )}
        >
          <Link
            href="/admin/dashboard"
            className="admin-focus flex min-w-0 items-center gap-2.5 rounded-control"
            onClick={onMobileClose}
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-control bg-brand-600 text-white">
              <Plane className="h-4 w-4" />
            </span>
            {!collapsed && (
              <span className="min-w-0">
                <span className="block truncate font-display text-[15px] font-bold leading-tight text-white">
                  Vacationdeal
                </span>
                <span className="block text-[10px] uppercase tracking-wider text-slate-500">
                  Travel CRM
                </span>
              </span>
            )}
          </Link>

          <button
            type="button"
            onClick={onMobileClose}
            aria-label="Close navigation"
            className="admin-focus ml-auto rounded-control p-1.5 text-slate-400 hover:bg-admin-navy-soft hover:text-white lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="admin-scroll min-h-0 flex-1 overflow-y-auto px-2.5 py-3">
          {groups.map((group) => (
            <NavGroupBlock
              key={group.id}
              group={group}
              collapsed={collapsed}
              open={!closedGroups.includes(group.id)}
              pathname={pathname}
              search={search}
              onToggle={() => toggleGroup(group.id)}
              onNavigate={onMobileClose}
            />
          ))}
        </nav>

        {/* Footer */}
        <div className="shrink-0 border-t border-admin-navy-line p-2.5">
          <UserBlock
            name={userName}
            email={userEmail}
            role={userRole}
            collapsed={collapsed}
            onNavigate={onMobileClose}
          />

          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "admin-focus mt-1 hidden w-full items-center gap-2.5 rounded-control px-2.5 py-2 text-[13px] font-medium text-slate-400 hover:bg-admin-navy-soft hover:text-white lg:flex",
              collapsed && "justify-center px-0",
            )}
          >
            {collapsed ? (
              <ChevronsRight className="h-[18px] w-[18px]" />
            ) : (
              <>
                <ChevronsLeft className="h-[18px] w-[18px]" />
                Collapse
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}

function NavGroupBlock({
  group,
  collapsed,
  open,
  pathname,
  search,
  onToggle,
  onNavigate,
}: {
  group: NavGroup;
  collapsed: boolean;
  open: boolean;
  pathname: string;
  search: string;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  // A collapsed rail has no room for headings, and hiding a group there would
  // strand its items with no way to reach them.
  const expanded = collapsed ? true : open;

  return (
    <div className="mb-1">
      {group.label && !collapsed && (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="admin-focus flex w-full items-center justify-between rounded-control px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300"
        >
          {group.label}
          <ChevronDown
            className={cn("h-3 w-3 transition-transform", !open && "-rotate-90")}
            aria-hidden
          />
        </button>
      )}

      {group.label && collapsed && <hr className="mx-2 my-2 border-admin-navy-line" />}

      {expanded && (
        <ul className="space-y-0.5">
          {group.items.map((item) => (
            <li key={item.href}>
              <SidebarLink
                href={item.href}
                icon={<item.icon className="h-[18px] w-[18px]" />}
                label={item.label}
                active={isNavItemActive(item, pathname, search)}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SidebarLink({
  href,
  icon,
  label,
  active,
  collapsed,
  onNavigate,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      // The label becomes the tooltip once the rail is collapsed, so the icons
      // are still identifiable.
      title={collapsed ? label : undefined}
      className={cn(
        "admin-focus flex items-center gap-2.5 rounded-control px-2.5 py-2 text-[13px] font-medium transition-colors",
        collapsed && "justify-center px-0",
        active
          ? "bg-brand-600 text-white shadow-sm"
          : "text-slate-400 hover:bg-admin-navy-soft hover:text-white",
      )}
    >
      <span className="shrink-0">{icon}</span>
      {!collapsed && <span className="truncate">{label}</span>}
      {collapsed && <span className="sr-only">{label}</span>}
    </Link>
  );
}

function UserBlock({
  name,
  email,
  role,
  collapsed,
  onNavigate,
}: {
  name: string;
  email: string;
  role: string;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const canOpenSettings = canAccessSection(role, "settings");
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div ref={ref} className="relative">
      {open && (
        <div
          role="menu"
          className="admin-animate-pop absolute bottom-full left-0 z-10 mb-1.5 w-full min-w-[200px] overflow-hidden rounded-card border border-admin-navy-line bg-admin-navy-soft py-1 shadow-xl"
        >
          <div className="px-3 py-2">
            <p className="truncate text-[13px] font-semibold text-white">{name}</p>
            <p className="truncate text-[11px] text-slate-400">{email || roleLabel(role)}</p>
            <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-500">
              {roleLabel(role)}
            </p>
          </div>
          <hr className="my-1 border-admin-navy-line" />
          {/* Settings is the only real destination here, and not every role
              can open it — offering it to someone who would be bounced
              straight back is worse than not offering it. */}
          {canOpenSettings && (
            <MenuRow
              href="/admin/settings"
              icon={<Settings className="h-4 w-4" />}
              onNavigate={() => {
                setOpen(false);
                onNavigate();
              }}
            >
              Settings
            </MenuRow>
          )}
          {/* A plain link, so signing out still works with JavaScript off. */}
          <a
            role="menuitem"
            href="/api/auth/signout"
            className="flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium text-red-300 hover:bg-admin-navy hover:text-red-200"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </a>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={collapsed ? name : undefined}
        className={cn(
          "admin-focus mt-1 flex w-full items-center gap-2.5 rounded-control p-2 text-left hover:bg-admin-navy-soft",
          collapsed && "justify-center p-1.5",
        )}
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-600/90 text-[11px] font-semibold text-white">
          {initials || "?"}
        </span>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-white">{name}</span>
              <span className="block truncate text-[11px] text-slate-500">
                {email || roleLabel(role)}
              </span>
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
          </>
        )}
      </button>
    </div>
  );
}

function MenuRow({
  href,
  icon,
  children,
  onNavigate,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium text-slate-300 hover:bg-admin-navy hover:text-white"
    >
      {icon}
      {children}
    </Link>
  );
}
