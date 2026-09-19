"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, Loader2, Phone } from "lucide-react";
import { StatusBadge, Avatar } from "@/components/admin/ui";
import { useToast } from "@/components/admin/Toast";
import { setLeadFollowUp } from "@/app/admin/(panel)/leads/actions";
import { leadStatusLabel } from "@/lib/crm";
import { leadStatusTone } from "@/lib/admin-status";
import { cn } from "@/lib/utils";

/**
 * Today's follow-up queue.
 *
 * Interactive because the point is to clear it without leaving the page:
 * completing clears the reminder, rescheduling pushes it out a day or a week.
 * Both go through the same `setLeadFollowUp` action the CRM uses, so the
 * ownership and permission checks are the ones already in place.
 */

export type FollowUpItem = {
  id: string;
  name: string;
  phone: string;
  destination: string | null;
  status: string;
  priority: string;
  nextFollowUpAt: string;
  assignedToName: string | null;
};

export function FollowUpList({
  overdue,
  today,
  upcoming,
}: {
  overdue: FollowUpItem[];
  today: FollowUpItem[];
  upcoming: FollowUpItem[];
}) {
  const total = overdue.length + today.length + upcoming.length;

  if (total === 0) {
    return (
      <div className="px-5 py-10 text-center">
        <span className="mx-auto mb-2.5 grid h-10 w-10 place-items-center rounded-full bg-emerald-50 text-emerald-600">
          <Check className="h-5 w-5" />
        </span>
        <p className="text-sm font-medium text-admin-text">Nothing to chase</p>
        <p className="mt-1 text-xs text-admin-text-muted">
          Set a follow-up date on a lead and it will show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-admin-border">
      <Group title="Overdue" tone="danger" items={overdue} />
      <Group title="Today" tone="warning" items={today} />
      <Group title="Next 7 days" tone="muted" items={upcoming} />
    </div>
  );
}

function Group({
  title,
  items,
  tone,
}: {
  title: string;
  items: FollowUpItem[];
  tone: "danger" | "warning" | "muted";
}) {
  if (items.length === 0) return null;

  const tones = {
    danger: "text-admin-danger",
    warning: "text-admin-warning",
    muted: "text-admin-text-subtle",
  };

  return (
    <div>
      <p className={cn("px-5 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider", tones[tone])}>
        {title} · {items.length}
      </p>
      <ul>
        {items.map((item) => (
          <Row key={item.id} item={item} />
        ))}
      </ul>
    </div>
  );
}

function Row({ item }: { item: FollowUpItem }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = React.useState<"done" | "later" | null>(null);

  const when = new Date(item.nextFollowUpAt);
  const time = when.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

  const run = async (kind: "done" | "later") => {
    setPending(kind);
    try {
      // Clearing the date is how the CRM marks a follow-up handled; pushing
      // it out a day is the "not now" path.
      const next = new Date();
      next.setDate(next.getDate() + 1);
      const result = await setLeadFollowUp(item.id, kind === "done" ? "" : next.toISOString().slice(0, 10));

      if (result && "ok" in result && result.ok === false) {
        toast.error(result.error);
        return;
      }
      toast.success(kind === "done" ? "Follow-up cleared." : "Moved to tomorrow.");
      router.refresh();
    } catch {
      toast.error("Could not update that follow-up.");
    } finally {
      setPending(null);
    }
  };

  return (
    <li className="group flex items-center gap-2.5 px-5 py-2.5 hover:bg-admin-bg">
      <Avatar name={item.name} size="sm" />

      <div className="min-w-0 flex-1">
        <Link
          href={`/admin/leads?lead=${item.id}`}
          className="block truncate text-[13px] font-medium text-admin-text hover:text-brand-700"
        >
          {item.name}
        </Link>
        <p className="flex flex-wrap items-center gap-x-1.5 truncate text-[11px] text-admin-text-muted">
          <CalendarClock className="h-3 w-3 shrink-0" aria-hidden />
          {time}
          {item.destination && <span className="truncate">· {item.destination}</span>}
          {item.assignedToName && <span className="truncate">· {item.assignedToName}</span>}
        </p>
      </div>

      <StatusBadge tone={leadStatusTone(item.status)} className="hidden shrink-0 sm:inline-flex">
        {leadStatusLabel(item.status)}
      </StatusBadge>

      <div className="flex shrink-0 items-center gap-0.5">
        <a
          href={`tel:${item.phone}`}
          title={`Call ${item.name}`}
          className="admin-focus rounded-control p-1.5 text-admin-text-subtle hover:bg-admin-muted hover:text-admin-text"
        >
          <Phone className="h-3.5 w-3.5" />
          <span className="sr-only">Call {item.name}</span>
        </a>
        <button
          type="button"
          onClick={() => run("later")}
          disabled={pending !== null}
          title="Move to tomorrow"
          className="admin-focus rounded-control p-1.5 text-admin-text-subtle hover:bg-admin-muted hover:text-admin-text disabled:opacity-50"
        >
          {pending === "later" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CalendarClock className="h-3.5 w-3.5" />
          )}
          <span className="sr-only">Move {item.name} to tomorrow</span>
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
          <span className="sr-only">Mark {item.name}&rsquo;s follow-up as done</span>
        </button>
      </div>
    </li>
  );
}
