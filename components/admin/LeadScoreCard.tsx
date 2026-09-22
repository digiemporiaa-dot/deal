import { Flame, Snowflake, Sun } from "lucide-react";
import { Card } from "@/components/admin/ui";
import { cn } from "@/lib/utils";
import type { LeadScore } from "@/lib/crm";

const BAND = {
  HOT: {
    label: "Hot",
    Icon: Flame,
    bar: "bg-red-500",
    text: "text-red-700",
    ring: "ring-red-200",
    tint: "bg-red-50",
    blurb: "Worth calling today.",
  },
  WARM: {
    label: "Warm",
    Icon: Sun,
    bar: "bg-amber-500",
    text: "text-amber-700",
    ring: "ring-amber-200",
    tint: "bg-amber-50",
    blurb: "Real, but not urgent yet.",
  },
  COLD: {
    label: "Cold",
    Icon: Snowflake,
    bar: "bg-slate-400",
    text: "text-slate-600",
    ring: "ring-slate-200",
    tint: "bg-slate-50",
    blurb: "Not enough here to act on.",
  },
} as const;

/**
 * The lead score, with its working shown.
 *
 * A number on its own invites people either to trust it blindly or to ignore
 * it — so every point is listed against the thing that earned it. Someone who
 * disagrees with the score can see exactly which signal they disagree with,
 * which is the difference between a tool and an oracle.
 */
export function LeadScoreCard({ score, className }: { score: LeadScore; className?: string }) {
  const band = BAND[score.band];
  const { Icon } = band;
  const earned = score.reasons.filter((reason) => reason.points > 0);

  return (
    <Card className={cn("p-5", className)}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-admin-text">Lead score</h2>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1",
            band.tint,
            band.text,
            band.ring,
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {band.label}
        </span>
      </div>

      <div className="flex items-end gap-2">
        <span className="font-display text-3xl font-bold leading-none text-admin-text tabular-nums">
          {score.score}
        </span>
        <span className="pb-0.5 text-sm text-admin-text-muted">/ 100</span>
      </div>

      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-admin-muted"
        role="img"
        aria-label={`Score ${score.score} out of 100 — ${band.label}`}
      >
        <div className={cn("h-full rounded-full transition-all", band.bar)} style={{ width: `${score.score}%` }} />
      </div>

      <p className="mt-2 text-xs text-admin-text-muted">{band.blurb}</p>

      {earned.length > 0 ? (
        <ul className="mt-4 space-y-1.5 border-t border-admin pt-3 text-sm">
          {earned.map((reason) => (
            <li key={reason.label} className="flex items-baseline justify-between gap-3">
              <span className="text-admin-text-muted">{reason.label}</span>
              <span className="shrink-0 font-medium tabular-nums text-admin-text">
                +{reason.points}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 border-t border-admin pt-3 text-sm text-admin-text-muted">
          Nothing to score yet — no budget, travel date or contact detail beyond the phone number.
        </p>
      )}
    </Card>
  );
}

/** The compact form, for a table cell or a board card. */
export function ScorePill({ score, band, className }: { score: number; band: string; className?: string }) {
  const tone = BAND[band as keyof typeof BAND] ?? BAND.COLD;
  return (
    <span
      title={`Lead score ${score} of 100 — ${tone.label}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ring-1",
        tone.tint,
        tone.text,
        tone.ring,
        className,
      )}
    >
      <tone.Icon className="h-3 w-3" />
      {score}
    </span>
  );
}
