import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The admin design system — server-safe pieces.
 *
 * Everything here renders without client JavaScript, which is what keeps
 * data-heavy admin pages as Server Components. Interactive primitives
 * (drawer, modal, menu, tabs) live in their own "use client" modules.
 *
 * Colours come from the tokens in globals.css via the `admin-*` Tailwind
 * scale. Components should not reach for a literal slate/blue shade: that is
 * how a panel ends up half a shade off from the one beside it, and it is what
 * would block a dark theme later.
 */

/* ───────────────────────────── page furniture ───────────────────────────── */

export type Crumb = { label: string; href?: string };

/** Breadcrumb trail for the topbar. The last entry is the current page. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex items-center gap-1 text-sm">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1">
              {index > 0 && (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-admin-text-subtle" aria-hidden />
              )}
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className="truncate text-admin-text-muted hover:text-admin-text"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={cn("truncate", last ? "font-medium text-admin-text" : "text-admin-text-muted")}
                  aria-current={last ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function PageHeader({
  title,
  description,
  action,
  meta,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** Small line under the title — "Updated just now", record counts, etc. */
  meta?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-[22px] font-bold leading-tight text-admin-text">{title}</h1>
        {description && <p className="mt-1 text-sm text-admin-text-muted">{description}</p>}
        {meta && <div className="mt-1.5 text-xs text-admin-text-subtle">{meta}</div>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}

/* ───────────────────────────── surfaces ───────────────────────────── */

export function Card({
  children,
  className,
  padded,
}: {
  children: React.ReactNode;
  className?: string;
  /** Adds the standard 20px inset. Omit for cards that hold a table. */
  padded?: boolean;
}) {
  return (
    <div className={cn("admin-card admin-card-shadow", padded && "p-5", className)}>{children}</div>
  );
}

/**
 * A card with a title row — the shape most dashboard panels take.
 * `action` sits opposite the title, typically a "View all" link.
 */
export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <Card className={cn("flex flex-col overflow-hidden", className)}>
      <div className="flex items-start justify-between gap-3 border-b border-admin px-5 py-4">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-admin-text">{title}</h2>
          {description && (
            <p className="mt-0.5 text-xs leading-relaxed text-admin-text-muted">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className={cn("min-w-0 flex-1", bodyClassName ?? "p-5")}>{children}</div>
    </Card>
  );
}

/** A chart panel: title, optional controls, then the chart itself. */
export function ChartCard({
  title,
  description,
  controls,
  footer,
  children,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  controls?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("flex flex-col overflow-hidden", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pb-3 pt-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-admin-text">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-admin-text-muted">{description}</p>}
        </div>
        {controls && <div className="flex items-center gap-1.5">{controls}</div>}
      </div>
      <div className="min-w-0 flex-1 px-5 pb-5">{children}</div>
      {footer && <div className="border-t border-admin px-5 py-3 text-xs text-admin-text-muted">{footer}</div>}
    </Card>
  );
}

/* ───────────────────────────── metrics ───────────────────────────── */

export type Delta = {
  /** Percentage change against the previous period of the same length. */
  percent: number;
  /** What it is compared against, e.g. "vs previous 30 days". */
  label: string;
  /** For metrics where down is good — pending payments, cancellations. */
  invert?: boolean;
};

/**
 * A KPI tile.
 *
 * `delta` and `sparkline` are optional on purpose: a metric with no honest
 * comparison (an all-time total, an operations count) shows the number alone
 * rather than an invented trend.
 */
export function StatCard({
  label,
  value,
  icon,
  tone = "brand",
  delta,
  sparkline,
  hint,
  href,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  tone?: "brand" | "green" | "amber" | "purple" | "slate" | "red";
  delta?: Delta | null;
  sparkline?: React.ReactNode;
  hint?: string;
  href?: string;
}) {
  const tones: Record<string, string> = {
    brand: "bg-brand-50 text-brand-600",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    purple: "bg-purple-50 text-purple-600",
    slate: "bg-admin-muted text-admin-text-muted",
    red: "bg-red-50 text-red-600",
  };

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-admin-text-muted">{label}</p>
        {icon && (
          <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-control", tones[tone])}>
            {icon}
          </span>
        )}
      </div>

      <p className="mt-2 font-display text-2xl font-bold leading-none text-admin-text">{value}</p>

      <div className="mt-2.5 flex items-end justify-between gap-3">
        <div className="min-w-0">
          {delta ? <DeltaPill {...delta} /> : hint ? (
            <span className="text-[11px] text-admin-text-subtle">{hint}</span>
          ) : null}
        </div>
        {sparkline && <div className="h-7 w-20 shrink-0">{sparkline}</div>}
      </div>
    </>
  );

  const className = "admin-card admin-card-shadow p-4";

  if (href) {
    return (
      <Link href={href} className={cn(className, "block transition-colors hover:border-brand-300")}>
        {body}
      </Link>
    );
  }
  return <div className={className}>{body}</div>;
}

/** The little +12.4% chip under a KPI. */
export function DeltaPill({ percent, label, invert }: Delta) {
  if (!Number.isFinite(percent)) return null;

  const flat = Math.abs(percent) < 0.05;
  // "Good" is not always "up": pending payments falling is an improvement.
  const good = invert ? percent < 0 : percent > 0;

  const tone = flat
    ? "text-admin-text-muted"
    : good
      ? "text-admin-success"
      : "text-admin-danger";

  const arrow = flat ? "" : percent > 0 ? "↑" : "↓";

  return (
    <span className="flex flex-wrap items-baseline gap-1.5">
      <span className={cn("text-xs font-semibold tabular-nums", tone)}>
        {arrow} {flat ? "0" : Math.abs(percent).toFixed(1)}%
      </span>
      <span className="text-[11px] text-admin-text-subtle">{label}</span>
    </span>
  );
}

/**
 * Inline sparkline for a KPI tile.
 * Deliberately axis-free: at 80×28 the shape is the only readable signal.
 */
export function Sparkline({
  points,
  color = "currentColor",
  className,
}: {
  points: number[];
  color?: string;
  className?: string;
}) {
  if (points.length < 2) return null;

  const width = 80;
  const height = 28;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;
  const step = width / (points.length - 1);

  const coords = points.map((value, index) => ({
    x: index * step,
    // A 2px inset stops the stroke being clipped at the extremes.
    y: height - 2 - ((value - min) / span) * (height - 4),
  }));

  const line = coords.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn("h-full w-full", className)}
      preserveAspectRatio="none"
      aria-hidden
      focusable="false"
    >
      <path d={area} fill={color} opacity={0.12} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* ───────────────────────────── badges ───────────────────────────── */

export type BadgeTone = "brand" | "green" | "amber" | "red" | "slate" | "purple" | "blue";

const BADGE_TONES: Record<BadgeTone, string> = {
  brand: "bg-brand-50 text-brand-700 ring-brand-600/15",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/15",
  red: "bg-red-50 text-red-700 ring-red-600/15",
  purple: "bg-purple-50 text-purple-700 ring-purple-600/15",
  blue: "bg-blue-50 text-blue-700 ring-blue-600/15",
  slate: "bg-admin-muted text-admin-text-muted ring-slate-500/10",
};

/**
 * Status pill.
 *
 * Takes a tone rather than guessing from the text, because the same word
 * means different things in different places — a "PENDING" payment is a
 * warning, a "PENDING" booking is merely new. Callers map their own domain
 * status to a tone (see `statusTone` helpers next to each feature).
 */
export function StatusBadge({
  children,
  tone = "slate",
  dot,
  className,
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  /** Adds a leading dot — useful in dense tables where colour alone is subtle. */
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-chip px-2 py-0.5 text-[11px] font-medium capitalize ring-1 ring-inset",
        BADGE_TONES[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden />}
      {children}
    </span>
  );
}

/* ───────────────────────────── avatar ───────────────────────────── */

/** Deterministic tint from the name, so a person keeps the same colour. */
const AVATAR_TINTS = [
  "bg-brand-100 text-brand-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-purple-100 text-purple-700",
  "bg-rose-100 text-rose-700",
  "bg-sky-100 text-sky-700",
  "bg-teal-100 text-teal-700",
];

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function Avatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    xs: "h-6 w-6 text-[10px]",
    sm: "h-8 w-8 text-xs",
    md: "h-9 w-9 text-sm",
    lg: "h-12 w-12 text-base",
  };

  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash + name.charCodeAt(i)) % AVATAR_TINTS.length;

  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-semibold",
        sizes[size],
        AVATAR_TINTS[hash],
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}

/* ───────────────────────────── buttons and links ───────────────────────────── */

const BUTTON_TONES = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 disabled:hover:bg-brand-600",
  outline: "border border-admin-border-strong bg-admin-card text-admin-text hover:bg-admin-muted",
  ghost: "text-admin-text-muted hover:bg-admin-muted hover:text-admin-text",
  danger: "bg-admin-danger text-white hover:bg-red-700",
};

export type ButtonTone = keyof typeof BUTTON_TONES;

export function buttonClasses(tone: ButtonTone = "primary", size: "sm" | "md" = "md"): string {
  return cn(
    "admin-focus inline-flex items-center justify-center gap-1.5 rounded-control font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
    size === "sm" ? "h-8 px-2.5 text-xs" : "h-9 px-3.5 text-sm",
    BUTTON_TONES[tone],
  );
}

export function AdminButtonLink({
  href,
  children,
  tone = "primary",
  size = "md",
  className,
  target,
}: {
  href: string;
  children: React.ReactNode;
  tone?: ButtonTone;
  size?: "sm" | "md";
  className?: string;
  target?: string;
}) {
  return (
    <Link href={href} target={target} className={cn(buttonClasses(tone, size), className)}>
      {children}
    </Link>
  );
}

/* ───────────────────────────── tables ───────────────────────────── */

/** Filter row above a table. Submits with GET so filters stay in the URL. */
export function FilterBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <form
      method="get"
      className={cn("admin-card admin-card-shadow mb-4 flex flex-wrap items-end gap-3 p-3.5", className)}
    >
      {children}
    </form>
  );
}

/**
 * Table shell.
 *
 * `stickyHeader` keeps the header visible while a long list scrolls; it needs
 * a bounded height on the wrapper, which `maxHeight` supplies.
 */
export function TableWrap({
  children,
  minWidth = 720,
  stickyHeader,
  maxHeight,
  className,
}: {
  children: React.ReactNode;
  minWidth?: number;
  stickyHeader?: boolean;
  maxHeight?: string;
  className?: string;
}) {
  return (
    <div
      className={cn("admin-scroll overflow-x-auto", stickyHeader && "overflow-y-auto", className)}
      style={maxHeight ? { maxHeight } : undefined}
    >
      <table
        className={cn("w-full text-left text-sm", stickyHeader && "[&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10")}
        style={{ minWidth }}
      >
        {children}
      </table>
    </div>
  );
}

/** Table head row. Kept as a component so every table's header matches. */
export function Thead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="border-b border-admin bg-admin-muted text-[11px] uppercase tracking-wide text-admin-text-muted">
      {children}
    </thead>
  );
}

export function Th({
  children,
  className,
  align = "left",
}: {
  children?: React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      scope="col"
      className={cn(
        "whitespace-nowrap px-4 py-2.5 font-medium",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Tbody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-admin-border">{children}</tbody>;
}

/** A body row. `onSelect` styling is applied by the caller's client wrapper. */
export function Td({
  children,
  className,
  align = "left",
}: {
  children?: React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}) {
  return (
    <td
      className={cn(
        "px-4 py-2.5 align-middle text-admin-text-muted",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </td>
  );
}

/** Sortable column header. Toggles direction through the URL, not client state. */
export function SortableTh({
  children,
  field,
  currentSort,
  params,
  basePath,
  align,
}: {
  children: React.ReactNode;
  field: string;
  currentSort?: string;
  params: Record<string, string | undefined>;
  basePath: string;
  align?: "left" | "right" | "center";
}) {
  const descending = currentSort === field;
  const next = descending ? `${field}_asc` : field;

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== "sort" && key !== "page") search.set(key, value);
  }
  search.set("sort", next);

  const active = currentSort === field || currentSort === `${field}_asc`;

  return (
    <Th align={align}>
      <Link
        href={`${basePath}?${search.toString()}`}
        className={cn("inline-flex items-center gap-1 hover:text-admin-text", active && "text-admin-text")}
      >
        {children}
        <span aria-hidden className={cn("text-[9px]", active ? "opacity-100" : "opacity-30")}>
          {currentSort === `${field}_asc` ? "▲" : "▼"}
        </span>
      </Link>
    </Th>
  );
}

/* ───────────────────────────── states ───────────────────────────── */

export function EmptyState({
  title,
  description,
  action,
  icon,
  compact,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-card border border-dashed border-admin-border-strong bg-admin-card text-center",
        compact ? "p-8" : "p-12",
      )}
    >
      {icon && (
        <span className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-admin-muted text-admin-text-subtle">
          {icon}
        </span>
      )}
      <h3 className={cn("font-semibold text-admin-text", compact ? "text-sm" : "text-base")}>{title}</h3>
      {description && (
        <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-admin-text-muted">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Something went wrong, stated without leaking why. */
export function ErrorState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-card border border-red-200 bg-red-50 p-8 text-center">
      <h3 className="text-sm font-semibold text-red-900">{title}</h3>
      {description && <p className="mx-auto mt-1.5 max-w-md text-sm text-red-700">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ───────────────────────────── skeletons ───────────────────────────── */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-control bg-admin-muted", className)} />;
}

export function TableSkeleton({ rows = 8, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("admin-card admin-card-shadow overflow-hidden", className)}>
      <div className="border-b border-admin bg-admin-muted px-4 py-3">
        <Skeleton className="h-3 w-40 bg-slate-200" />
      </div>
      <div className="divide-y divide-admin-border">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 px-4 py-3.5">
            <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
            <Skeleton className="h-3 flex-1" />
            <Skeleton className="hidden h-3 w-24 sm:block" />
            <Skeleton className="hidden h-3 w-20 md:block" />
            <Skeleton className="h-5 w-16 rounded-chip" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="admin-card admin-card-shadow p-4">
      <div className="flex items-start justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-8 rounded-control" />
      </div>
      <Skeleton className="mt-3 h-6 w-20" />
      <Skeleton className="mt-3 h-3 w-28" />
    </div>
  );
}

export function CardSkeleton({ lines = 4, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("admin-card admin-card-shadow p-5", className)}>
      <Skeleton className="h-3.5 w-36" />
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: lines }).map((_, index) => (
          <Skeleton key={index} className="h-3" />
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────────── timeline ───────────────────────────── */

export type TimelineEntry = {
  id: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  timestamp: React.ReactNode;
  icon?: React.ReactNode;
  tone?: BadgeTone;
};

const TIMELINE_TONES: Record<BadgeTone, string> = {
  brand: "bg-brand-50 text-brand-600 ring-brand-100",
  green: "bg-emerald-50 text-emerald-600 ring-emerald-100",
  amber: "bg-amber-50 text-amber-600 ring-amber-100",
  red: "bg-red-50 text-red-600 ring-red-100",
  purple: "bg-purple-50 text-purple-600 ring-purple-100",
  blue: "bg-blue-50 text-blue-600 ring-blue-100",
  slate: "bg-admin-muted text-admin-text-muted ring-slate-100",
};

/**
 * Vertical activity timeline.
 *
 * The connecting rule is drawn on the list rather than per item, so the last
 * entry does not trail a line into empty space.
 */
export function Timeline({ entries, empty }: { entries: TimelineEntry[]; empty?: React.ReactNode }) {
  if (entries.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-admin-text-subtle">
        {empty ?? "Nothing here yet."}
      </p>
    );
  }

  return (
    <ol className="relative space-y-4 before:absolute before:bottom-3 before:left-[15px] before:top-3 before:w-px before:bg-admin-border">
      {entries.map((entry) => (
        <li key={entry.id} className="relative flex gap-3">
          <span
            className={cn(
              "z-[1] grid h-8 w-8 shrink-0 place-items-center rounded-full ring-4 ring-admin-card",
              TIMELINE_TONES[entry.tone ?? "slate"],
            )}
          >
            {entry.icon}
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <p className="text-sm font-medium text-admin-text">{entry.title}</p>
              <span className="shrink-0 text-[11px] text-admin-text-subtle">{entry.timestamp}</span>
            </div>
            {entry.description && (
              <div className="mt-0.5 whitespace-pre-line text-[13px] leading-relaxed text-admin-text-muted">
                {entry.description}
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ───────────────────────────── misc ───────────────────────────── */

/** Label/value row used inside drawers and detail panels. */
export function DetailRow({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 py-2", className)}>
      <dt className="shrink-0 text-xs font-medium text-admin-text-muted">{label}</dt>
      <dd className="min-w-0 text-right text-[13px] font-medium text-admin-text">{children}</dd>
    </div>
  );
}

/**
 * Page links that preserve the current filters.
 * `params` should be the page's own search params; `page` is replaced.
 */
export function Pagination({
  page,
  pageCount,
  total,
  basePath,
  params,
  unit = "record",
}: {
  page: number;
  pageCount: number;
  total: number;
  basePath: string;
  params: Record<string, string | undefined>;
  unit?: string;
}) {
  const plural = (count: number) => `${count} ${unit}${count === 1 ? "" : "s"}`;

  if (pageCount <= 1) {
    return <p className="mt-3 text-xs text-admin-text-subtle">{plural(total)}</p>;
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
      <p className="text-xs text-admin-text-subtle">
        Page {page} of {pageCount} · {plural(total)}
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
    "admin-focus inline-flex h-8 min-w-8 items-center justify-center rounded-control border px-2.5 text-xs font-medium",
    active
      ? "border-brand-600 bg-brand-600 text-white"
      : "border-admin-border-strong bg-admin-card text-admin-text-muted hover:bg-admin-muted hover:text-admin-text",
    disabled && "pointer-events-none opacity-40",
  );
  if (disabled) return <span className={classes}>{children}</span>;
  return (
    <Link href={href} className={classes} aria-current={active ? "page" : undefined}>
      {children}
    </Link>
  );
}
