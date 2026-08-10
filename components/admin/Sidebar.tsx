"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Package, MapPin, CalendarCheck, Users, MessageSquare,
  Star, FileText, Tag, Image as ImageIcon, Settings, UserCog, Menu, X, Plane, LogOut, ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/packages", label: "Packages", icon: Package },
  { href: "/admin/destinations", label: "Destinations", icon: MapPin },
  { href: "/admin/bookings", label: "Bookings", icon: CalendarCheck },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/leads", label: "Leads", icon: ClipboardList },
  { href: "/admin/testimonials", label: "Testimonials", icon: Star },
  { href: "/admin/blogs", label: "Blogs", icon: FileText },
  { href: "/admin/coupons", label: "Coupons", icon: Tag },
  { href: "/admin/media", label: "Media", icon: ImageIcon },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/users", label: "Users", icon: UserCog },
];

export function Sidebar({ userName, userRole }: { userName: string; userRole: string }) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <span className="flex items-center gap-2 font-bold text-slate-900">
          <Plane className="h-5 w-5 text-brand-600" /> Admin
        </span>
        <button onClick={() => setOpen((v) => !v)} aria-label="Menu" className="rounded-md p-2 hover:bg-slate-100">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-6">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-white">
            <Plane className="h-5 w-5" />
          </span>
          <span className="font-display text-lg font-bold text-slate-900">Vacationdeal</span>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                )}
              >
                <item.icon className="h-4.5 w-4.5 h-[18px] w-[18px]" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-4">
          <div className="mb-3">
            <p className="truncate text-sm font-semibold text-slate-900">{userName}</p>
            <p className="text-xs text-slate-500">{userRole.replace(/_/g, " ")}</p>
          </div>
          <a
            href="/api/auth/signout"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </a>
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={() => setOpen(false)} />}
    </>
  );
}
