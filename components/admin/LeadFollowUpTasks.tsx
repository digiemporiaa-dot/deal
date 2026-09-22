"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  Check,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import {
  createLeadFollowUp,
  completeLeadFollowUp,
  rescheduleLeadFollowUp,
  deleteLeadFollowUp,
} from "@/app/admin/(panel)/leads/actions";
import { useToast } from "@/components/admin/Toast";
import { Input, Select, Textarea, Label } from "@/components/ui/Field";
import { buttonClasses } from "@/components/admin/ui";
import { cn, formatDate } from "@/lib/utils";

export type FollowUpItem = {
  id: string;
  dueAt: string;
  type: string;
  typeLabel: string;
  title: string;
  note: string | null;
  status: string;
  completedAt: string | null;
  outcome: string | null;
  assignedToName: string | null;
};

const TYPE_ICON: Record<string, typeof Phone> = {
  CALL: Phone,
  WHATSAPP: MessageCircle,
  EMAIL: Mail,
  MEETING: Users,
  TASK: CalendarClock,
};

const TYPES = [
  { value: "CALL", label: "Call" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "EMAIL", label: "Email" },
  { value: "MEETING", label: "Meeting" },
  { value: "TASK", label: "Task" },
];

/** `datetime-local` wants local time, not the UTC an ISO string carries. */
function localInputValue(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function inDays(days: number, hour = 10): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return localInputValue(date);
}

/**
 * The follow-up queue for one lead.
 *
 * A lead used to have a single reminder date that each new one overwrote.
 * This lists the real tasks: what the follow-up is for, who owns it, whether
 * it happened and what came of it. Completed ones stay visible, because "we
 * called twice and she asked us to try next month" is the context the next
 * person needs.
 */
export function LeadFollowUpTasks({
  leadId,
  items,
  readOnly,
}: {
  leadId: string;
  items: FollowUpItem[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [adding, setAdding] = React.useState(false);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const [form, setForm] = React.useState({
    title: "",
    type: "CALL",
    dueAt: inDays(1),
    note: "",
  });

  const pending = items.filter((item) => item.status === "PENDING");
  const done = items.filter((item) => item.status !== "PENDING");
  const startOfToday = React.useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const result = await createLeadFollowUp({ leadId, ...form });
      if (result.ok) {
        toast.success("Follow-up scheduled.");
        setForm({ title: "", type: "CALL", dueAt: inDays(1), note: "" });
        setAdding(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Could not schedule that follow-up. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function run(id: string, action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    setPendingId(id);
    try {
      const result = await action();
      if (result.ok) {
        toast.success(success);
        router.refresh();
      } else {
        toast.error(result.error ?? "That did not work.");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {pending.length === 0 && done.length === 0 && (
        <p className="text-sm text-admin-text-muted">
          Nothing scheduled. A lead with no next step is a lead that goes quiet.
        </p>
      )}

      {pending.length > 0 && (
        <ul className="space-y-2">
          {pending.map((item) => {
            const due = new Date(item.dueAt);
            const overdue = due.getTime() < startOfToday;
            const Icon = TYPE_ICON[item.type] ?? CalendarClock;
            const working = pendingId === item.id;

            return (
              <li
                key={item.id}
                className={cn(
                  "rounded-control border p-3",
                  overdue ? "border-red-200 bg-red-50/60" : "border-admin bg-admin-card",
                )}
              >
                <div className="flex items-start gap-3">
                  <Icon
                    className={cn("mt-0.5 h-4 w-4 shrink-0", overdue ? "text-red-600" : "text-admin-text-subtle")}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-admin-text">{item.title}</p>
                    <p className={cn("text-xs", overdue ? "font-semibold text-red-600" : "text-admin-text-muted")}>
                      {item.typeLabel} · {overdue ? "Overdue — " : ""}
                      {formatDate(due)}
                      {item.assignedToName ? ` · ${item.assignedToName}` : ""}
                    </p>
                    {item.note && <p className="mt-1 text-xs text-admin-text-muted">{item.note}</p>}

                    {!readOnly && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          disabled={working}
                          onClick={() =>
                            run(
                              item.id,
                              () => completeLeadFollowUp({ id: item.id, status: "DONE" }),
                              "Marked done.",
                            )
                          }
                          className={buttonClasses("outline", "sm")}
                        >
                          {working ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                          Done
                        </button>

                        <label className="sr-only" htmlFor={`due-${item.id}`}>
                          Reschedule {item.title}
                        </label>
                        <Input
                          id={`due-${item.id}`}
                          inputSize="sm"
                          type="datetime-local"
                          defaultValue={localInputValue(due)}
                          disabled={working}
                          onChange={(event) => {
                            if (!event.target.value) return;
                            run(
                              item.id,
                              () => rescheduleLeadFollowUp({ id: item.id, dueAt: event.target.value }),
                              "Moved.",
                            );
                          }}
                          className="w-[190px]"
                        />

                        <button
                          type="button"
                          disabled={working}
                          onClick={() => run(item.id, () => deleteLeadFollowUp(item.id), "Removed.")}
                          aria-label={`Delete follow-up ${item.title}`}
                          className="rounded-control p-1.5 text-admin-text-subtle hover:bg-admin-muted hover:text-red-600 disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!readOnly &&
        (adding ? (
          <form onSubmit={submit} className="space-y-3 rounded-control border border-admin bg-admin-bg p-3">
            <div>
              <Label htmlFor="fu-title">What needs doing</Label>
              <Input
                id="fu-title"
                inputSize="sm"
                required
                minLength={2}
                maxLength={200}
                value={form.title}
                placeholder="Call back with Kashmir options"
                onChange={(event) => setForm({ ...form, title: event.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="fu-type">How</Label>
                <Select
                  id="fu-type"
                  inputSize="sm"
                  value={form.type}
                  onChange={(event) => setForm({ ...form, type: event.target.value })}
                >
                  {TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="fu-due">When</Label>
                <Input
                  id="fu-due"
                  inputSize="sm"
                  type="datetime-local"
                  required
                  value={form.dueAt}
                  onChange={(event) => setForm({ ...form, dueAt: event.target.value })}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[
                { label: "Tomorrow", days: 1 },
                { label: "In 3 days", days: 3 },
                { label: "Next week", days: 7 },
              ].map((quick) => (
                <button
                  key={quick.label}
                  type="button"
                  onClick={() => setForm({ ...form, dueAt: inDays(quick.days) })}
                  className="rounded-full border border-admin-border-strong px-2.5 py-1 text-xs font-medium text-admin-text-muted hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
                >
                  {quick.label}
                </button>
              ))}
            </div>

            <div>
              <Label htmlFor="fu-note">Note (optional)</Label>
              <Textarea
                id="fu-note"
                rows={2}
                maxLength={2000}
                value={form.note}
                onChange={(event) => setForm({ ...form, note: event.target.value })}
              />
            </div>

            <div className="flex gap-2">
              <button type="submit" disabled={busy} className={buttonClasses("primary", "sm")}>
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Schedule
              </button>
              <button
                type="button"
                onClick={() => setAdding(false)}
                className={buttonClasses("ghost", "sm")}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button type="button" onClick={() => setAdding(true)} className={buttonClasses("outline", "sm")}>
            <Plus className="h-3.5 w-3.5" />
            Schedule a follow-up
          </button>
        ))}

      {done.length > 0 && (
        <details className="border-t border-admin pt-3">
          <summary className="cursor-pointer text-xs font-medium text-admin-text-muted hover:text-admin-text">
            {done.length} completed or cancelled
          </summary>
          <ul className="mt-2 space-y-2">
            {done.map((item) => (
              <li key={item.id} className="text-xs text-admin-text-muted">
                <span className={cn("font-medium", item.status === "DONE" ? "text-admin-text" : "line-through")}>
                  {item.title}
                </span>{" "}
                · {item.typeLabel} · {formatDate(new Date(item.dueAt))}
                {item.outcome && <span className="block pl-1 italic">“{item.outcome}”</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
