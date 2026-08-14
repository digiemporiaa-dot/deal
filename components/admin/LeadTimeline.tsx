"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, StickyNote, Mail, Phone, ArrowRightLeft, CalendarClock, AlertTriangle } from "lucide-react";
import { addLeadNote, logLeadCall } from "@/app/admin/(panel)/leads/actions";
import { Textarea } from "@/components/ui/Field";

export type TimelineItem = {
  id: string;
  type: string;
  body: string;
  subject: string | null;
  emailTo: string | null;
  delivered: boolean;
  createdAt: string;
  author: string | null;
};

const META: Record<string, { label: string; Icon: typeof StickyNote; className: string }> = {
  NOTE: { label: "Note", Icon: StickyNote, className: "bg-slate-100 text-slate-600" },
  EMAIL: { label: "Email sent", Icon: Mail, className: "bg-brand-50 text-brand-600" },
  CALL: { label: "Call", Icon: Phone, className: "bg-emerald-50 text-emerald-600" },
  STATUS: { label: "Status", Icon: ArrowRightLeft, className: "bg-amber-50 text-amber-600" },
  FOLLOWUP: { label: "Follow-up", Icon: CalendarClock, className: "bg-purple-50 text-purple-600" },
};

export function LeadTimeline({ leadId, items }: { leadId: string; items: TimelineItem[] }) {
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [pending, setPending] = React.useState<"note" | "call" | null>(null);

  const submit = async (kind: "note" | "call") => {
    if (!body.trim() && kind === "note") return;
    setPending(kind);
    if (kind === "note") await addLeadNote(leadId, body);
    else await logLeadCall(leadId, body);
    setBody("");
    router.refresh();
    setPending(null);
  };

  return (
    <div>
      <div className="mb-5">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="What happened? e.g. Customer wants Bali in December, budget ₹80k…"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => submit("note")}
            disabled={pending !== null || !body.trim()}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {pending === "note" ? <Loader2 className="h-4 w-4 animate-spin" /> : <StickyNote className="h-4 w-4" />} Add note
          </button>
          <button
            type="button"
            onClick={() => submit("call")}
            disabled={pending !== null}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {pending === "call" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />} Log a call
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {items.length === 0 && <p className="text-sm text-slate-400">No activity yet. Everything your team does with this lead will appear here.</p>}
        {items.map((item) => {
          const meta = META[item.type] ?? META.NOTE;
          const Icon = meta.Icon;
          return (
            <div key={item.id} className="flex gap-3 rounded-xl border border-slate-200 p-3">
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${meta.className}`}>
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{meta.label}</span>
                  {item.type === "EMAIL" && item.emailTo && (
                    <span className="text-xs text-slate-400">to {item.emailTo}</span>
                  )}
                  {item.type === "EMAIL" && !item.delivered && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                      <AlertTriangle className="h-3 w-3" /> Not delivered
                    </span>
                  )}
                </div>
                {item.subject && <p className="mt-1 text-sm font-semibold text-slate-900">{item.subject}</p>}
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">{item.body}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {item.author || "Team"} · {new Date(item.createdAt).toLocaleString("en-IN")}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
