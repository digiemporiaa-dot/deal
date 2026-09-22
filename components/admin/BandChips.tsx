import Link from "next/link";
import { Flame, Snowflake, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const BANDS = [
  { key: "HOT", label: "Hot", Icon: Flame, on: "border-red-300 bg-red-50 text-red-700" },
  { key: "WARM", label: "Warm", Icon: Sun, on: "border-amber-300 bg-amber-50 text-amber-700" },
  { key: "COLD", label: "Cold", Icon: Snowflake, on: "border-slate-300 bg-slate-100 text-slate-700" },
] as const;

/**
 * Filter the pipeline by how warm a lead is.
 *
 * Counts cover open leads only — the number is meant to answer "how much live
 * work is hot", and a thousand won deals from last year would drown that.
 * Clicking the active chip clears the filter, which is what people expect
 * from a toggle.
 */
export function BandChips({
  counts,
  active,
  basePath,
  params,
}: {
  counts: { hot: number; warm: number; cold: number };
  active?: string;
  basePath: string;
  params?: URLSearchParams;
}) {
  const href = (band: string | null) => {
    const next = new URLSearchParams(params?.toString() ?? "");
    next.delete("band");
    next.delete("page");
    if (band) next.set("band", band);
    const query = next.toString();
    return query ? `${basePath}?${query}` : basePath;
  };

  const value = (key: string) =>
    key === "HOT" ? counts.hot : key === "WARM" ? counts.warm : counts.cold;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-1.5 text-[13px]">
      {BANDS.map((band) => {
        const isActive = active === band.key;
        return (
          <Link
            key={band.key}
            href={href(isActive ? null : band.key)}
            aria-pressed={isActive}
            className={cn(
              "admin-focus inline-flex items-center gap-1.5 rounded-control border px-2.5 py-1.5 font-medium transition-colors",
              isActive
                ? band.on
                : "border-admin bg-admin-card text-admin-text-muted hover:border-brand-300 hover:text-brand-700",
            )}
          >
            <band.Icon className="h-3.5 w-3.5" />
            {band.label}
            <span className="rounded bg-admin-muted px-1.5 text-[11px] tabular-nums">
              {value(band.key)}
            </span>
          </Link>
        );
      })}
      {active && (
        <Link href={href(null)} className="px-2 text-xs text-admin-text-muted underline hover:text-admin-text">
          Clear
        </Link>
      )}
    </div>
  );
}
