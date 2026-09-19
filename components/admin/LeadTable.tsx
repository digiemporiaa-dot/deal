"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Phone, Mail, MessageCircle, CalendarClock, Loader2, Flame } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Field";
import { LeadStatusSelect } from "@/components/admin/LeadStatusSelect";
import { LeadAssignSelect } from "@/components/admin/LeadAssignSelect";
import { useToast } from "@/components/admin/Toast";
import { LEAD_STATUSES, leadStatusLabel, leadSourceLabel } from "@/lib/crm";
import { bulkUpdateLeadStatus, bulkAssignLeads } from "@/app/admin/(panel)/leads/actions";
import { formatDate } from "@/lib/utils";

export type LeadRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  whatsapp: string | null;
  destination: string | null;
  budget: string | null;
  source: string;
  campaign: string | null;
  status: string;
  priority: string;
  createdAt: string;
  nextFollowUpAt: string | null;
  lastActivityAt: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
  activityCount: number;
};

const PRIORITY_TONE: Record<string, "red" | "amber" | "slate" | "brand"> = {
  URGENT: "red",
  HIGH: "amber",
  NORMAL: "slate",
  LOW: "slate",
};

/**
 * The CRM list.
 *
 * Selection and bulk actions live here because they need client state; the
 * filtering, sorting and paging are all done on the server. The bulk actions
 * re-check permissions and ownership server-side, so a hand-crafted id list
 * cannot reach a lead the user may not touch.
 */
export function LeadTable({
  leads,
  members,
  showOwner,
  canAssign,
}: {
  leads: LeadRow[];
  members: { id: string; name: string; role: string }[];
  showOwner: boolean;
  canAssign: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [pending, setPending] = React.useState(false);

  const allSelected = leads.length > 0 && selected.size === leads.length;

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(leads.map((lead) => lead.id)));
  };

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runBulk = async (action: () => Promise<{ ok: boolean; error?: string; count?: number }>) => {
    setPending(true);
    try {
      const result = await action();
      if (result.ok) {
        toast.success(`${result.count ?? 0} lead${result.count === 1 ? "" : "s"} updated.`);
        setSelected(new Set());
        router.refresh();
      } else {
        toast.error(result.error || "That bulk action failed.");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  };

  const now = Date.now();

  return (
    <div>
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-brand-50 px-4 py-3">
          <p className="text-sm font-medium text-slate-900">
            {selected.size} selected
            {pending && <Loader2 className="ml-2 inline h-3.5 w-3.5 animate-spin" />}
          </p>

          <Select
            className="h-9 w-auto py-0 text-sm"
            defaultValue=""
            disabled={pending}
            onChange={(event) => {
              const status = event.target.value;
              event.target.value = "";
              if (!status) return;
              void runBulk(() => bulkUpdateLeadStatus([...selected], status));
            }}
          >
            <option value="">Set status to…</option>
            {LEAD_STATUSES.map((status) => (
              <option key={status} value={status}>
                {leadStatusLabel(status)}
              </option>
            ))}
          </Select>

          {canAssign && (
            <Select
              className="h-9 w-auto py-0 text-sm"
              defaultValue=""
              disabled={pending}
              onChange={(event) => {
                const userId = event.target.value;
                event.target.value = "";
                if (userId === "") return;
                void runBulk(() => bulkAssignLeads([...selected], userId === "__none__" ? "" : userId));
              }}
            >
              <option value="">Assign to…</option>
              <option value="__none__">Unassign</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </Select>
          )}

          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Clear selection
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Select all leads on this page"
                  className="h-4 w-4 rounded border-slate-300 text-brand-600"
                />
              </th>
              <th className="px-4 py-3">Lead</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Trip</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Received</th>
              <th className="px-4 py-3">Follow-up</th>
              {showOwner && <th className="px-4 py-3">Assigned to</th>}
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">View</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads.map((lead) => {
              const followUp = lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt) : null;
              const overdue = followUp ? followUp.getTime() < now : false;
              const isSelected = selected.has(lead.id);

              return (
                <tr
                  key={lead.id}
                  className={
                    isSelected
                      ? "bg-brand-50/70"
                      : overdue
                        ? "bg-red-50/60 hover:bg-red-50"
                        : "hover:bg-slate-50"
                  }
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggle(lead.id)}
                      aria-label={`Select ${lead.name}`}
                      className="h-4 w-4 rounded border-slate-300 text-brand-600"
                    />
                  </td>

                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{lead.name}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                      {lead.priority !== "NORMAL" && (
                        <Badge tone={PRIORITY_TONE[lead.priority] ?? "slate"}>
                          <Flame className="mr-1 h-3 w-3" />
                          {lead.priority.toLowerCase()}
                        </Badge>
                      )}
                      {lead.activityCount} {lead.activityCount === 1 ? "note" : "notes"}
                    </p>
                  </td>

                  <td className="px-4 py-3 text-slate-600">
                    <div className="flex flex-col gap-0.5 text-xs">
                      <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1 hover:text-brand-600">
                        <Phone className="h-3 w-3" /> {lead.phone}
                      </a>
                      {lead.email && (
                        <a
                          href={`mailto:${lead.email}`}
                          className="inline-flex items-center gap-1 truncate hover:text-brand-600"
                        >
                          <Mail className="h-3 w-3" /> {lead.email}
                        </a>
                      )}
                      {lead.whatsapp && (
                        <span className="inline-flex items-center gap-1">
                          <MessageCircle className="h-3 w-3" /> {lead.whatsapp}
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-3 text-slate-600">
                    <p>{lead.destination || "—"}</p>
                    {lead.budget && <p className="text-xs text-slate-400">Budget: {lead.budget}</p>}
                  </td>

                  <td className="px-4 py-3">
                    <p className="text-xs font-medium text-slate-700">{leadSourceLabel(lead.source)}</p>
                    {lead.campaign && (
                      <p className="truncate text-xs text-slate-400" title={lead.campaign}>
                        {lead.campaign}
                      </p>
                    )}
                  </td>

                  <td className="px-4 py-3 text-xs text-slate-500">{formatDate(lead.createdAt)}</td>

                  <td className="px-4 py-3">
                    {followUp ? (
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-medium ${
                          overdue ? "text-red-600" : "text-slate-600"
                        }`}
                      >
                        <CalendarClock className="h-3 w-3" /> {formatDate(followUp)}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>

                  {showOwner && (
                    <td className="px-4 py-3">
                      {canAssign ? (
                        <LeadAssignSelect leadId={lead.id} value={lead.assignedToId} members={members} />
                      ) : (
                        <span className="text-xs text-slate-500">{lead.assignedToName ?? "—"}</span>
                      )}
                    </td>
                  )}

                  <td className="px-4 py-3">
                    <LeadStatusSelect id={lead.id} value={lead.status} />
                  </td>

                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/leads/${lead.id}`}
                      className="text-sm font-semibold text-brand-600 hover:underline"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
