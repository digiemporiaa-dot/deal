"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRightLeft,
  CalendarClock,
  Check,
  ExternalLink,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  Send,
  StickyNote,
  Trash2,
} from "lucide-react";
import { Drawer } from "@/components/admin/overlay";
import {
  Avatar,
  DetailRow,
  StatusBadge,
  Timeline,
  buttonClasses,
  type TimelineEntry,
} from "@/components/admin/ui";
import { Tabs } from "@/components/admin/Tabs";
import { useToast } from "@/components/admin/Toast";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { LEAD_STATUSES, LEAD_PRIORITIES, leadStatusLabel, leadSourceLabel } from "@/lib/crm";
import { leadStatusTone, priorityTone, humanStatus } from "@/lib/admin-status";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { cn, formatDate } from "@/lib/utils";
import {
  addLeadNote,
  assignLead,
  logLeadCall,
  setLeadFollowUp,
  updateLeadPriority,
  updateLeadStatus,
} from "@/app/admin/(panel)/leads/actions";
import type { LeadDetail } from "@/app/api/admin/leads/[id]/route";

/**
 * Lead detail drawer.
 *
 * Opening a lead slides this over the list instead of navigating away, so an
 * agent working a filtered queue keeps their place — which is the whole point
 * of a CRM list. The full page at /admin/leads/[id] still exists for a direct
 * link or a deeper edit.
 *
 * Which lead is open lives in the URL (`?lead=<id>`), so the browser's back
 * button closes the drawer and a lead can be linked to from search or the
 * dashboard.
 *
 * Every mutation calls the same Server Actions the full page uses — the
 * ownership and permission checks are the ones already in place, and this
 * component never becomes a second, weaker path to the same data.
 */

const STAGES = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "CONVERTED"] as const;

const NOTE_META: Record<string, { label: string; icon: React.ReactNode; tone: "slate" | "brand" | "green" | "amber" | "purple" }> = {
  NOTE: { label: "Note", icon: <StickyNote className="h-3.5 w-3.5" />, tone: "slate" },
  EMAIL: { label: "Email sent", icon: <Mail className="h-3.5 w-3.5" />, tone: "brand" },
  CALL: { label: "Call logged", icon: <Phone className="h-3.5 w-3.5" />, tone: "green" },
  STATUS: { label: "Status changed", icon: <ArrowRightLeft className="h-3.5 w-3.5" />, tone: "amber" },
  FOLLOWUP: { label: "Follow-up", icon: <CalendarClock className="h-3.5 w-3.5" />, tone: "purple" },
};

export function LeadDrawer({ leadId, onClose }: { leadId: string | null; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [lead, setLead] = React.useState<LeadDetail | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(
    async (id: string, background = false) => {
      if (!background) {
        setLoading(true);
        setLead(null);
      }
      setError(null);
      try {
        const response = await fetch(`/api/admin/leads/${id}`);
        if (response.status === 404) {
          setError("This lead is no longer available.");
          return;
        }
        if (!response.ok) throw new Error("failed");
        setLead((await response.json()) as LeadDetail);
      } catch {
        setError("Could not load this lead.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  React.useEffect(() => {
    if (leadId) void load(leadId);
  }, [leadId, load]);

  /** Run a Server Action, then refresh both the drawer and the list beneath. */
  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      const result = (await action()) as { ok?: boolean; error?: string } | undefined;
      if (result && result.ok === false) {
        toast.error(result.error ?? "That did not work.");
        return false;
      }
      toast.success(success);
      if (leadId) await load(leadId, true);
      router.refresh();
      return true;
    } catch {
      toast.error("Something went wrong. Please try again.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open={leadId !== null}
      onClose={onClose}
      width="lg"
      busy={busy}
      title={lead?.name ?? "Lead"}
      header={lead ? <LeadHeader lead={lead} /> : undefined}
      footer={
        lead && (
          <div className="flex items-center justify-between gap-2">
            <Link
              href={`/admin/leads/${lead.id}`}
              className={buttonClasses("ghost", "sm")}
            >
              Open full record
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
            <span className="text-[11px] text-admin-text-subtle">
              Enquiry received {formatDate(lead.createdAt)}
            </span>
          </div>
        )
      }
    >
      {loading && <DrawerSkeleton />}

      {error && !loading && (
        <div className="p-5">
          <div className="rounded-card border border-red-200 bg-red-50 p-5 text-center">
            <p className="text-sm font-medium text-red-900">{error}</p>
            <button
              type="button"
              onClick={() => leadId && void load(leadId)}
              className={cn(buttonClasses("outline", "sm"), "mt-3")}
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {lead && !loading && (
        <div className="p-5">
          <Pipeline current={lead.status} />

          <div className="mt-5">
            <Tabs
              items={[
                {
                  id: "overview",
                  label: "Overview",
                  content: <Overview lead={lead} busy={busy} run={run} />,
                },
                {
                  id: "activity",
                  label: "Activity",
                  badge:
                    lead.notes.length > 0 ? (
                      <span className="rounded-full bg-admin-muted px-1.5 text-[10px] tabular-nums text-admin-text-muted">
                        {lead.notes.length}
                      </span>
                    ) : undefined,
                  content: <Activity lead={lead} busy={busy} run={run} />,
                },
                {
                  id: "enquiry",
                  label: "Enquiry",
                  content: <Enquiry lead={lead} />,
                },
              ]}
            />
          </div>
        </div>
      )}
    </Drawer>
  );
}

/* ───────────────────────── header ───────────────────────── */

function LeadHeader({ lead }: { lead: LeadDetail }) {
  const whatsapp = lead.whatsapp || lead.phone;

  return (
    <div className="flex items-start gap-3">
      <Avatar name={lead.name} size="lg" />
      <div className="min-w-0 flex-1">
        <h2 className="truncate font-display text-lg font-bold leading-tight text-admin-text">
          {lead.name}
        </h2>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-admin-text-muted">
          <span className="truncate">{lead.phone}</span>
          {lead.email && <span className="truncate">· {lead.email}</span>}
        </p>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <ContactAction href={`tel:${lead.phone}`} icon={<Phone className="h-3.5 w-3.5" />} label="Call" />
          {lead.email && (
            <ContactAction
              href={`mailto:${lead.email}`}
              icon={<Mail className="h-3.5 w-3.5" />}
              label="Email"
            />
          )}
          <ContactAction
            href={buildWhatsAppLink(whatsapp, `Hi ${lead.name}, regarding your travel enquiry`)}
            icon={<MessageCircle className="h-3.5 w-3.5" />}
            label="WhatsApp"
            external
          />
          <StatusBadge tone={priorityTone(lead.priority)} className="ml-auto">
            {humanStatus(lead.priority)}
          </StatusBadge>
        </div>
      </div>
    </div>
  );
}

function ContactAction({
  href,
  icon,
  label,
  external,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className="admin-focus inline-flex h-7 items-center gap-1.5 rounded-control border border-admin px-2 text-[11px] font-semibold text-admin-text-muted hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
    >
      {icon}
      {label}
    </a>
  );
}

/* ───────────────────────── pipeline ───────────────────────── */

/**
 * Where this lead has reached.
 *
 * LOST is not a stage on the line — it can happen at any point — so a lost
 * lead shows the track greyed with a clear label rather than being forced
 * into a position on it.
 */
function Pipeline({ current }: { current: string }) {
  const lost = current === "LOST";
  const index = STAGES.indexOf(current as (typeof STAGES)[number]);
  // FOLLOW_UP sits between contacted and qualified in practice.
  const reached = current === "FOLLOW_UP" ? 1 : index;

  return (
    <div>
      <div className="flex items-center justify-between gap-1">
        {STAGES.map((stage, position) => {
          const done = !lost && reached >= position;
          const active = !lost && reached === position;

          return (
            <React.Fragment key={stage}>
              {position > 0 && (
                <span
                  aria-hidden
                  className={cn(
                    "h-0.5 flex-1 rounded-full",
                    done && !lost ? "bg-brand-500" : "bg-admin-border",
                  )}
                />
              )}
              <span className="flex flex-col items-center gap-1">
                <span
                  className={cn(
                    "grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold",
                    lost
                      ? "bg-admin-muted text-admin-text-subtle"
                      : done
                        ? "bg-brand-600 text-white"
                        : "border border-admin bg-admin-card text-admin-text-subtle",
                    active && "ring-4 ring-brand-100",
                  )}
                >
                  {done && !active ? <Check className="h-3 w-3" /> : position + 1}
                </span>
                <span
                  className={cn(
                    "whitespace-nowrap text-[10px] font-medium",
                    active ? "text-brand-700" : "text-admin-text-subtle",
                  )}
                >
                  {leadStatusLabel(stage)}
                </span>
              </span>
            </React.Fragment>
          );
        })}
      </div>

      {lost && (
        <p className="mt-3 rounded-control bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          This enquiry was marked lost.
        </p>
      )}
    </div>
  );
}

/* ───────────────────────── overview tab ───────────────────────── */

type Runner = (action: () => Promise<unknown>, success: string) => Promise<boolean>;

function Overview({ lead, busy, run }: { lead: LeadDetail; busy: boolean; run: Runner }) {
  const travellers =
    lead.adults || lead.children
      ? `${lead.adults ?? 0} adult${(lead.adults ?? 0) === 1 ? "" : "s"}${
          lead.children ? `, ${lead.children} child${lead.children === 1 ? "" : "ren"}` : ""
        }`
      : lead.travellers
        ? String(lead.travellers)
        : "—";

  return (
    <div className="space-y-5">
      {/* Controls an agent uses constantly, grouped at the top. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-admin-text-muted">Status</span>
          <Select
            inputSize="sm"
            value={lead.status}
            disabled={!lead.can.update || busy}
            onChange={(event) => void run(() => updateLeadStatus(lead.id, event.target.value), "Status updated.")}
          >
            {LEAD_STATUSES.map((status) => (
              <option key={status} value={status}>
                {leadStatusLabel(status)}
              </option>
            ))}
          </Select>
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-admin-text-muted">Priority</span>
          <Select
            inputSize="sm"
            value={lead.priority}
            disabled={!lead.can.update || busy}
            onChange={(event) =>
              void run(() => updateLeadPriority(lead.id, event.target.value), "Priority updated.")
            }
          >
            {LEAD_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {humanStatus(priority)}
              </option>
            ))}
          </Select>
        </label>

        {lead.can.assign && (
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-[11px] font-medium text-admin-text-muted">Lead owner</span>
            <Select
              inputSize="sm"
              value={lead.assignedToId ?? ""}
              disabled={busy}
              onChange={(event) => void run(() => assignLead(lead.id, event.target.value), "Lead reassigned.")}
            >
              <option value="">Unassigned</option>
              {lead.members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </Select>
          </label>
        )}
      </div>

      <FollowUpPanel lead={lead} busy={busy} run={run} />

      <div>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-admin-text-subtle">
          Trip
        </h3>
        <dl className="divide-y divide-admin-border">
          <DetailRow label="Destination">{lead.destination || "—"}</DetailRow>
          <DetailRow label="Travel date">
            {lead.travelDate ? formatDate(lead.travelDate) : "—"}
          </DetailRow>
          <DetailRow label="Return date">
            {lead.returnDate ? formatDate(lead.returnDate) : "—"}
          </DetailRow>
          <DetailRow label="Travellers">{travellers}</DetailRow>
          <DetailRow label="Budget">{lead.budget || "—"}</DetailRow>
          <DetailRow label="Country">{lead.country || "—"}</DetailRow>
        </dl>
      </div>

      <div>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-admin-text-subtle">
          Attribution
        </h3>
        <dl className="divide-y divide-admin-border">
          <DetailRow label="Source">{leadSourceLabel(lead.source)}</DetailRow>
          <DetailRow label="Campaign">{lead.campaign || "—"}</DetailRow>
          <DetailRow label="Medium">{lead.medium || "—"}</DetailRow>
          <DetailRow label="Landing page">
            {lead.landingPage ? (
              <span className="block max-w-[220px] truncate" title={lead.landingPage}>
                {lead.landingPage}
              </span>
            ) : (
              "—"
            )}
          </DetailRow>
        </dl>
      </div>
    </div>
  );
}

function FollowUpPanel({ lead, busy, run }: { lead: LeadDetail; busy: boolean; run: Runner }) {
  const [date, setDate] = React.useState(lead.nextFollowUpAt?.slice(0, 10) ?? "");

  React.useEffect(() => setDate(lead.nextFollowUpAt?.slice(0, 10) ?? ""), [lead.nextFollowUpAt]);

  const inDays = (days: number) => {
    const target = new Date();
    target.setDate(target.getDate() + days);
    return target.toISOString().slice(0, 10);
  };

  const overdue =
    lead.nextFollowUpAt !== null && new Date(lead.nextFollowUpAt) < new Date(new Date().toDateString());

  return (
    <div
      className={cn(
        "rounded-card border p-3.5",
        overdue ? "border-red-200 bg-red-50" : "border-admin bg-admin-bg",
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold text-admin-text">
          <CalendarClock className="h-3.5 w-3.5" />
          Next follow-up
        </h3>
        {overdue && <span className="text-[11px] font-semibold text-admin-danger">Overdue</span>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          inputSize="sm"
          type="date"
          value={date}
          disabled={!lead.can.update || busy}
          onChange={(event) => setDate(event.target.value)}
          className="w-[150px]"
          aria-label="Follow-up date"
        />
        <button
          type="button"
          disabled={!lead.can.update || busy || date === (lead.nextFollowUpAt?.slice(0, 10) ?? "")}
          onClick={() => void run(() => setLeadFollowUp(lead.id, date), "Follow-up scheduled.")}
          className={buttonClasses("primary", "sm")}
        >
          Schedule
        </button>

        {["Tomorrow", "In 3 days", "Next week"].map((label, index) => (
          <button
            key={label}
            type="button"
            disabled={!lead.can.update || busy}
            onClick={() =>
              void run(() => setLeadFollowUp(lead.id, inDays([1, 3, 7][index]!)), "Follow-up scheduled.")
            }
            className="admin-focus rounded-chip border border-admin bg-admin-card px-2 py-1 text-[11px] font-medium text-admin-text-muted hover:border-brand-300 hover:text-brand-700 disabled:opacity-50"
          >
            {label}
          </button>
        ))}

        {lead.nextFollowUpAt && (
          <button
            type="button"
            disabled={!lead.can.update || busy}
            onClick={() => void run(() => setLeadFollowUp(lead.id, ""), "Follow-up cleared.")}
            className="admin-focus ml-auto rounded-chip px-2 py-1 text-[11px] font-medium text-admin-text-subtle hover:text-admin-danger disabled:opacity-50"
          >
            <Trash2 className="mr-1 inline h-3 w-3" />
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── activity tab ───────────────────────── */

function Activity({ lead, busy, run }: { lead: LeadDetail; busy: boolean; run: Runner }) {
  const [body, setBody] = React.useState("");
  const [kind, setKind] = React.useState<"note" | "call">("note");

  const submit = async () => {
    if (!body.trim()) return;
    const text = body;
    const ok = await run(
      () => (kind === "note" ? addLeadNote(lead.id, text) : logLeadCall(lead.id, text)),
      kind === "note" ? "Note added." : "Call logged.",
    );
    if (ok) setBody("");
  };

  const entries: TimelineEntry[] = lead.notes.map((note) => {
    const meta = NOTE_META[note.type] ?? NOTE_META.NOTE!;
    return {
      id: note.id,
      tone: meta.tone,
      icon: meta.icon,
      title: note.subject || meta.label,
      description: (
        <>
          {note.body}
          {note.author && (
            <span className="mt-1 block text-[11px] text-admin-text-subtle">— {note.author}</span>
          )}
        </>
      ),
      timestamp: new Date(note.createdAt).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      }),
    };
  });

  return (
    <div className="space-y-5">
      {lead.can.update && (
        <div className="rounded-card border border-admin bg-admin-bg p-3.5">
          {/*
            These pick what kind of entry this is; the button below performs
            it. They are named for the kind rather than the action so that two
            controls do not answer to "Add note" — which is confusing to look
            at and ambiguous to anyone navigating by accessible name.
          */}
          <div role="group" aria-label="Entry type" className="mb-2 flex gap-1">
            {(
              [
                ["note", "Note", <StickyNote key="n" className="h-3 w-3" />],
                ["call", "Call", <Phone key="c" className="h-3 w-3" />],
              ] as const
            ).map(([value, label, icon]) => (
              <button
                key={value}
                type="button"
                aria-pressed={kind === value}
                onClick={() => setKind(value)}
                className={cn(
                  "admin-focus inline-flex items-center gap-1.5 rounded-chip px-2.5 py-1 text-[11px] font-semibold",
                  kind === value
                    ? "bg-brand-600 text-white"
                    : "bg-admin-card text-admin-text-muted hover:text-admin-text",
                )}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>

          <Textarea
            rows={3}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={
              kind === "note"
                ? "What happened? e.g. sent the Kashmir itinerary, waiting on dates."
                : "How did the call go?"
            }
            className="min-h-[72px] text-[13px]"
          />

          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || !body.trim()}
            className={cn(buttonClasses("primary", "sm"), "mt-2")}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {kind === "note" ? "Add note" : "Log call"}
          </button>
        </div>
      )}

      <Timeline
        entries={entries}
        empty="No activity recorded yet. Notes, calls, emails and status changes all appear here."
      />
    </div>
  );
}

/* ───────────────────────── enquiry tab ───────────────────────── */

function Enquiry({ lead }: { lead: LeadDetail }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-admin-text-subtle">
          What they wrote
        </h3>
        {lead.message ? (
          <p className="whitespace-pre-line rounded-card border border-admin bg-admin-bg p-3.5 text-[13px] leading-relaxed text-admin-text">
            {lead.message}
          </p>
        ) : (
          <p className="rounded-card border border-dashed border-admin p-3.5 text-[13px] text-admin-text-subtle">
            No message was included with this enquiry.
          </p>
        )}
      </div>

      <dl className="divide-y divide-admin-border">
        <DetailRow label="Received">{formatDate(lead.createdAt)}</DetailRow>
        <DetailRow label="Status">
          <StatusBadge tone={leadStatusTone(lead.status)}>{leadStatusLabel(lead.status)}</StatusBadge>
        </DetailRow>
        <DetailRow label="Owner">{lead.assignedToName || "Unassigned"}</DetailRow>
        <DetailRow label="WhatsApp">{lead.whatsapp || lead.phone}</DetailRow>
      </dl>
    </div>
  );
}

/* ───────────────────────── skeleton ───────────────────────── */

function DrawerSkeleton() {
  return (
    <div className="animate-pulse space-y-5 p-5">
      <div className="flex items-center justify-between gap-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <React.Fragment key={index}>
            {index > 0 && <span className="h-0.5 flex-1 bg-admin-muted" />}
            <span className="h-5 w-5 rounded-full bg-admin-muted" />
          </React.Fragment>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="h-14 rounded-control bg-admin-muted" />
        <div className="h-14 rounded-control bg-admin-muted" />
      </div>
      <div className="h-20 rounded-card bg-admin-muted" />
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-8 rounded-control bg-admin-muted" />
        ))}
      </div>
    </div>
  );
}
