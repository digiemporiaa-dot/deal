"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  Clock,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  Users,
} from "lucide-react";
import {
  completeLeadFollowUp,
  completeLeadFollowUps,
  snoozeLeadFollowUp,
} from "@/app/admin/(panel)/leads/actions";
import { useToast } from "@/components/admin/Toast";
import { StatusBadge, Avatar, buttonClasses } from "@/components/admin/ui";
import { ScorePill } from "@/components/admin/LeadScoreCard";
import { leadStatusLabel } from "@/lib/crm";
import { leadStatusTone } from "@/lib/admin-status";
import { cn } from "@/lib/utils";

/**
 * The follow-up queue.
 *
 * One component in two sizes: `compact` is the dashboard card, `full` is the
 * /admin/follow-ups page with selection and bulk actions. They are the same
 * thing at different densities, and keeping them as one component is what
 * stops "done" meaning two different things depending on where you clicked
 * it.
 *
 * Every action works on a *task*, not on the lead. That distinction is the
 * whole point of the queue: a lead with three things outstanding is three
 * rows here, and completing one leaves the other two alone.
 */

export type QueueRow = {
  id: string;
  leadId: string;
  title: string;
  type: string;
  typeLabel: string;
  note: string | null;
  dueAt: string;
  bucket: string;
  daysLate: number;
  escalated: boolean;
  assignedToName: string | null;
  leadName: string;
  leadPhone: string;
  leadStatus: string;
  leadScore: number;
  leadScoreBand: string;
  leadDestination: string | null;
};

const TYPE_ICON: Record<string, typeof Phone> = {
  CALL: Phone,
  WHATSAPP: MessageCircle,
  EMAIL: Mail,
  MEETING: Users,
  TASK: CalendarClock,
};

const BUCKET_TONE: Record<string, string> = {
  overdue: "text-admin-danger",
  today: "text-admin-warning",
  tomorrow: "text-admin-text-muted",
  week: "text-admin-text-subtle",
  later: "text-admin-text-subtle",
};

export function FollowUpQueue({
  groups,
  variant = "full",
  canEdit = true,
}: {
  groups: { bucket: string; label: string; items: QueueRow[] }[];
  variant?: "full" | "compact";
  canEdit?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState(false);

  const total = groups.reduce((sum, group) => sum + group.items.length, 0);
  const allIds = groups.flatMap((group) => group.items.map((item) => item.id));

  // Drop selections for rows the server no longer sends, so a stale id can
  // never ride along in a bulk action.
  React.useEffect(() => {
    setSelected((current) => {
      const live = new Set(allIds);
      const next = new Set([...current].filter((id) => live.has(id)));
      return next.size === current.size ? current : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allIds.join(",")]);

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function completeSelected() {
    if (selected.size === 0 || busy) return;
    setBusy(true);
    try {
      const result = await completeLeadFollowUps([...selected]);
      if (result.ok) {
        toast.success(
          result.skipped > 0
            ? `${result.count} completed, ${result.skipped} skipped.`
            : `${result.count} follow-up${result.count === 1 ? "" : "s"} completed.`,
        );
        setSelected(new Set());
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Could not complete those follow-ups.");
    } finally {
      setBusy(false);
    }
  }

  if (total === 0) {
    return (
      <div className="px-5 py-10 text-center">
        <span className="mx-auto mb-2.5 grid h-10 w-10 place-items-center rounded-full bg-emerald-50 text-emerald-600">
          <Check className="h-5 w-5" />
        </span>
        <p className="text-sm font-medium text-admin-text">Nothing to chase</p>
        <p className="mt-1 text-xs text-admin-text-muted">
          Schedule a follow-up on a lead and it will appear here.
        </p>
      </div>
    );
  }

  return (
    <div>
      {variant === "full" && canEdit && selected.size > 0 && (
        <div className="sticky top-0 z-20 mb-2 flex items-center gap-3 rounded-control border border-brand-200 bg-brand-50 px-3 py-2">
          <span className="text-sm font-medium text-brand-800">
            {selected.size} selected
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={completeSelected}
            className={buttonClasses("primary", "sm")}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Mark done
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className={buttonClasses("ghost", "sm")}
          >
            Clear
          </button>
        </div>
      )}

      <div className="divide-y divide-admin-border">
        {groups
          .filter((group) => group.items.length > 0)
          .map((group) => (
            <div key={group.bucket}>
              <p
                className={cn(
                  "px-5 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider",
                  BUCKET_TONE[group.bucket] ?? "text-admin-text-subtle",
                )}
              >
                {group.label} · {group.items.length}
              </p>
              <ul>
                {group.items.map((item) => (
                  <Row
                    key={item.id}
                    item={item}
                    variant={variant}
                    canEdit={canEdit}
                    selected={selected.has(item.id)}
                    onToggle={() => toggle(item.id)}
                  />
                ))}
              </ul>
            </div>
          ))}
      </div>
    </div>
  );
}

function Row({
  item,
  variant,
  canEdit,
  selected,
  onToggle,
}: {
  item: QueueRow;
  variant: "full" | "compact";
  canEdit: boolean;
  selected: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = React.useState<"done" | "snooze" | null>(null);
  const Icon = TYPE_ICON[item.type] ?? CalendarClock;

  const when = new Date(item.dueAt);
  const time = when.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

  async function run(kind: "done" | "snooze", days = 1) {
    setPending(kind);
    try {
      const result =
        kind === "done"
          ? await completeLeadFollowUp({ id: item.id, status: "DONE" })
          : await snoozeLeadFollowUp(item.id, days);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(kind === "done" ? "Marked done." : `Moved on ${days} day${days === 1 ? "" : "s"}.`);
      router.refresh();
    } catch {
      toast.error("Could not update that follow-up.");
    } finally {
      setPending(null);
    }
  }

  return (
    <li
      className={cn(
        "group flex items-center gap-2.5 px-5 py-2.5 hover:bg-admin-bg",
        item.escalated && "border-l-2 border-l-red-500 bg-red-50/40",
        selected && "bg-brand-50/60",
      )}
    >
      {variant === "full" && canEdit && (
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={`Select ${item.title} for ${item.leadName}`}
          className="h-3.5 w-3.5 shrink-0 rounded border-admin-border-strong text-brand-600 focus:ring-brand-500"
        />
      )}

      <Icon
        className={cn(
          "h-4 w-4 shrink-0",
          item.daysLate > 0 ? "text-admin-danger" : "text-admin-text-subtle",
        )}
        aria-hidden
      />

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5">
          <Link
            href={`/admin/leads/${item.leadId}`}
            className="truncate text-[13px] font-medium text-admin-text hover:text-brand-700"
          >
            {item.title}
          </Link>
          {item.escalated && (
            <span
              title={`Overdue by ${item.daysLate} days`}
              className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700"
            >
              <AlertTriangle className="h-2.5 w-2.5" />
              {item.daysLate}d late
            </span>
          )}
        </p>

        <p className="flex flex-wrap items-center gap-x-1.5 truncate text-[11px] text-admin-text-muted">
          <Clock className="h-3 w-3 shrink-0" aria-hidden />
          {time}
          <span className="truncate">· {item.typeLabel}</span>
          <span className="truncate">· {item.leadName}</span>
          {item.leadDestination && <span className="truncate">· {item.leadDestination}</span>}
          {variant === "full" && item.assignedToName && (
            <span className="truncate">· {item.assignedToName}</span>
          )}
        </p>
      </div>

      {variant === "full" && (
        <ScorePill score={item.leadScore} band={item.leadScoreBand} className="hidden shrink-0 md:inline-flex" />
      )}

      <StatusBadge tone={leadStatusTone(item.leadStatus)} className="hidden shrink-0 sm:inline-flex">
        {leadStatusLabel(item.leadStatus)}
      </StatusBadge>

      {variant === "full" && <Avatar name={item.leadName} size="sm" className="hidden shrink-0 lg:inline-flex" />}

      <div className="flex shrink-0 items-center gap-0.5">
        <a
          href={`tel:${item.leadPhone}`}
          title={`Call ${item.leadName}`}
          className="admin-focus rounded-control p-1.5 text-admin-text-subtle hover:bg-admin-muted hover:text-admin-text"
        >
          <Phone className="h-3.5 w-3.5" />
          <span className="sr-only">Call {item.leadName}</span>
        </a>

        {canEdit && (
          <>
            <button
              type="button"
              onClick={() => run("snooze", 1)}
              disabled={pending !== null}
              title="Move to tomorrow"
              className="admin-focus rounded-control p-1.5 text-admin-text-subtle hover:bg-admin-muted hover:text-admin-text disabled:opacity-50"
            >
              {pending === "snooze" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CalendarClock className="h-3.5 w-3.5" />
              )}
              <span className="sr-only">Move {item.title} to tomorrow</span>
            </button>

            <button
              type="button"
              onClick={() => run("done")}
              disabled={pending !== null}
              title="Mark as done"
              className="admin-focus rounded-control p-1.5 text-admin-text-subtle hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-50"
            >
              {pending === "done" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              <span className="sr-only">Mark {item.title} as done</span>
            </button>
          </>
        )}
      </div>
    </li>
  );
}
