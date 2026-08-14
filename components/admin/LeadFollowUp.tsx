"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Loader2, X } from "lucide-react";
import { setLeadFollowUp } from "@/app/admin/(panel)/leads/actions";
import { Input } from "@/components/ui/Field";

function toInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function plusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function LeadFollowUp({ leadId, current }: { leadId: string; current: string | null }) {
  const router = useRouter();
  const [value, setValue] = React.useState(toInputValue(current));
  const [pending, setPending] = React.useState(false);

  const save = async (date: string) => {
    setPending(true);
    setValue(date);
    await setLeadFollowUp(leadId, date);
    router.refresh();
    setPending(false);
  };

  const due = value ? new Date(value + "T23:59:59") < new Date() : false;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <CalendarClock className={`h-4 w-4 ${due ? "text-red-500" : "text-slate-400"}`} />
        <Input
          type="date"
          value={value}
          disabled={pending}
          onChange={(e) => save(e.target.value)}
          className="h-9"
        />
        {pending && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
        {value && !pending && (
          <button
            type="button"
            onClick={() => save("")}
            title="Clear follow-up"
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { label: "Tomorrow", days: 1 },
          { label: "In 3 days", days: 3 },
          { label: "Next week", days: 7 },
        ].map((q) => (
          <button
            key={q.label}
            type="button"
            disabled={pending}
            onClick={() => save(plusDays(q.days))}
            className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50"
          >
            {q.label}
          </button>
        ))}
      </div>

      {value && (
        <p className={`text-xs ${due ? "font-semibold text-red-600" : "text-slate-500"}`}>
          {due ? "Follow-up overdue" : `Next follow-up: ${new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`}
        </p>
      )}
    </div>
  );
}
