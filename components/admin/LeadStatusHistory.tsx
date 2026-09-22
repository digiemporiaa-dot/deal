import { StatusBadge } from "@/components/admin/ui";
import { leadStatusLabel } from "@/lib/crm";
import { leadStatusTone } from "@/lib/admin-status";
import { formatDate } from "@/lib/utils";

export type StatusChange = {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  reason: string | null;
  at: string;
  byName: string | null;
  heldForMs: number | null;
};

/** "3 days", "4 hours", "22 minutes" — the coarsest unit that is still true. */
function duration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${Math.max(1, minutes)} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

/**
 * How the lead moved through the pipeline.
 *
 * Read from `LeadStatusChange`, so the time in each stage is measured rather
 * than guessed from `updatedAt` — which only ever knows about the last edit.
 * The current stage shows how long it has been sitting there, which is
 * usually the more interesting number.
 */
export function LeadStatusHistory({ changes }: { changes: StatusChange[] }) {
  if (changes.length === 0) {
    return (
      <p className="text-sm text-admin-text-muted">
        No pipeline moves recorded yet. Every change from here on is logged with who made it and
        how long the lead sat in each stage.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {[...changes].reverse().map((change) => (
        <li key={change.id} className="flex items-start gap-3 text-sm">
          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-400" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-1.5">
              {change.fromStatus && (
                <>
                  <span className="text-admin-text-muted">{leadStatusLabel(change.fromStatus)}</span>
                  <span className="text-admin-text-subtle" aria-hidden>
                    →
                  </span>
                </>
              )}
              <StatusBadge tone={leadStatusTone(change.toStatus)} dot className="px-0 ring-0">
                {leadStatusLabel(change.toStatus)}
              </StatusBadge>
            </p>
            <p className="text-xs text-admin-text-muted">
              {formatDate(new Date(change.at))}
              {change.byName ? ` · ${change.byName}` : ""}
              {change.heldForMs !== null
                ? ` · held ${duration(change.heldForMs)}`
                : " · current stage"}
            </p>
            {change.reason && (
              <p className="mt-0.5 text-xs italic text-admin-text-muted">“{change.reason}”</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
