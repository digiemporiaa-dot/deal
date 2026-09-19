import Link from "next/link";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon,
  tone = "brand",
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  tone?: "brand" | "green" | "amber" | "purple";
}) {
  const tones = {
    brand: "bg-brand-50 text-brand-600",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    purple: "bg-purple-50 text-purple-600",
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{label}</p>
        {icon && <span className={cn("grid h-9 w-9 place-items-center rounded-lg", tones[tone])}>{icon}</span>}
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-2xl border border-slate-200 bg-white", className)}>{children}</div>;
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      {description && <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Simple primary link styled as a button for admin pages. */
export function AdminButtonLink({ href, children, tone = "primary" }: { href: string; children: React.ReactNode; tone?: "primary" | "outline" }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold",
        tone === "primary" ? "bg-brand-600 text-white hover:bg-brand-700" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
      )}
    >
      {children}
    </Link>
  );
}

/** Panel wrapper for a row of list filters above a table. */
export function FilterBar({ children }: { children: React.ReactNode }) {
  return (
    <form
      method="get"
      className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4"
    >
      {children}
    </form>
  );
}

/** Horizontally scrollable table shell, so wide admin tables work on tablets. */
export function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full min-w-[720px] text-left text-sm">{children}</table>
    </div>
  );
}

/** Something went wrong, stated without leaking why. */
export function ErrorState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
      <h3 className="text-base font-semibold text-red-900">{title}</h3>
      {description && <p className="mx-auto mt-2 max-w-md text-sm text-red-700">{description}</p>}
    </div>
  );
}

/** Placeholder rows shown by a route's loading.tsx while data is fetched. */
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-10 animate-pulse rounded-lg bg-slate-100" />
      ))}
    </div>
  );
}

/**
 * Page links that preserve the current filters.
 *
 * `params` should be the page's own search params; `page` is replaced.
 */
export function Pagination({
  page,
  pageCount,
  total,
  basePath,
  params,
}: {
  page: number;
  pageCount: number;
  total: number;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  if (pageCount <= 1) {
    return (
      <p className="mt-3 text-xs text-slate-500">
        {total} {total === 1 ? "record" : "records"}
      </p>
    );
  }

  const href = (target: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== "page") search.set(key, value);
    }
    search.set("page", String(target));
    return `${basePath}?${search.toString()}`;
  };

  // A short window around the current page keeps the control usable at any size.
  const first = Math.max(1, Math.min(page - 2, pageCount - 4));
  const numbers = Array.from({ length: Math.min(5, pageCount) }, (_, i) => first + i).filter(
    (n) => n >= 1 && n <= pageCount,
  );

  return (
    <nav className="mt-4 flex flex-wrap items-center justify-between gap-3" aria-label="Pagination">
      <p className="text-xs text-slate-500">
        Page {page} of {pageCount} · {total} {total === 1 ? "record" : "records"}
      </p>
      <div className="flex items-center gap-1">
        <PageLink href={href(Math.max(1, page - 1))} disabled={page <= 1}>
          Previous
        </PageLink>
        {numbers.map((n) => (
          <PageLink key={n} href={href(n)} active={n === page}>
            {n}
          </PageLink>
        ))}
        <PageLink href={href(Math.min(pageCount, page + 1))} disabled={page >= pageCount}>
          Next
        </PageLink>
      </div>
    </nav>
  );
}

function PageLink({
  href,
  children,
  active,
  disabled,
}: {
  href: string;
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
}) {
  const classes = cn(
    "inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-3 text-sm font-medium",
    active
      ? "border-brand-600 bg-brand-600 text-white"
      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
    disabled && "pointer-events-none opacity-40",
  );
  if (disabled) return <span className={classes}>{children}</span>;
  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}
