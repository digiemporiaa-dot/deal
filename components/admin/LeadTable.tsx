"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, Flame, Loader2, Mail, MessageCircle, Phone, X } from "lucide-react";
import {
  Avatar,
  StatusBadge,
  TableWrap,
  Thead,
  Tbody,
  Th,
  Td,
  EmptyState,
  buttonClasses,
} from "@/components/admin/ui";
import { Select } from "@/components/ui/Field";
import { useToast } from "@/components/admin/Toast";
import { LeadDrawer } from "@/components/admin/LeadDrawer";
import { useRowDrawer } from "@/components/admin/RowDrawerTable";
import { LEAD_STATUSES, leadStatusLabel, leadSourceLabel, isClosedStatus } from "@/lib/crm";
import { ScorePill } from "@/components/admin/LeadScoreCard";
import { leadStatusTone, priorityTone, humanStatus } from "@/lib/admin-status";
import { bulkUpdateLeadStatus, bulkAssignLeads } from "@/app/admin/(panel)/leads/actions";
import { cn, formatDate } from "@/lib/utils";

/**
 * The CRM list.
 *
 * Selection, bulk actions and the detail drawer live here because they need
 * client state; the filtering, sorting and paging are all done on the server,
 * so the browser never holds more than one page of leads.
 *
 * Clicking a row opens the drawer rather than navigating (§23) — an agent
 * working a filtered queue keeps their scroll position and their filters. The
 * open lead is kept in the URL so Back closes it and a lead can be linked to.
 *
 * The bulk actions re-check permissions and ownership server-side, so a
 * hand-crafted id list cannot reach a lead the user may not touch.
 */

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
  score: number;
  scoreBand: string;
  tags: string[];
};

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

  // The open lead is mirrored into the URL, so Back closes the drawer and the
  // link is shareable — the dashboard and global search both link straight to
  // a lead.
  const { openId: openLeadId, setOpenId: setOpenLead } = useRowDrawer("lead");

  const allSelected = leads.length > 0 && selected.size === leads.length;

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(leads.map((lead) => lead.id)));

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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

  const startOfToday = React.useMemo(() => new Date(new Date().toDateString()).getTime(), []);

  if (leads.length === 0) {
    return (
      <EmptyState
        bordered={false}
        icon={<Mail className="h-5 w-5" />}
        title="No leads match these filters"
        description="Clear the filters to see everything, or wait for the next enquiry — leads from the website form land here automatically."
        action={
          <Link href="/admin/leads" className={buttonClasses("outline", "sm")}>
            Clear filters
          </Link>
        }
      />
    );
  }

  return (
    <>
      {/* Bulk action bar, shown only when something is selected. */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2.5 border-b border-brand-200 bg-brand-50 px-4 py-2.5">
          <p className="text-[13px] font-semibold text-brand-900">
            {selected.size} selected
            {pending && <Loader2 className="ml-2 inline h-3.5 w-3.5 animate-spin" />}
          </p>

          <Select
            inputSize="sm"
            className="w-auto"
            defaultValue=""
            disabled={pending}
            aria-label="Set status for selected leads"
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
              inputSize="sm"
              className="w-auto"
              defaultValue=""
              disabled={pending}
              aria-label="Assign selected leads"
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
            className="admin-focus ml-auto inline-flex items-center gap-1 rounded-control px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        </div>
      )}

      <TableWrap minWidth={1080}>
        <Thead>
          <tr>
            <Th className="w-10">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                aria-label="Select all leads on this page"
                className="h-3.5 w-3.5 rounded border-admin-border-strong text-brand-600 focus:ring-brand-500"
              />
            </Th>
            <Th className="w-14">Score</Th>
            <Th>Lead</Th>
            <Th>Contact</Th>
            <Th>Trip</Th>
            <Th>Source</Th>
            <Th>Follow-up</Th>
            {showOwner && <Th>Owner</Th>}
            <Th>Status</Th>
            <Th align="right">Received</Th>
          </tr>
        </Thead>

        <Tbody>
          {leads.map((lead) => {
            // A closed lead has nothing due, whatever date the column still
            // carries from before it was won or lost — showing it in red
            // sends people to chase work that is already over.
            const closed = isClosedStatus(lead.status);
            const followUp = !closed && lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt) : null;
            const overdue = followUp ? followUp.getTime() < startOfToday : false;
            const isSelected = selected.has(lead.id);
            const isOpen = openLeadId === lead.id;

            return (
              <tr
                key={lead.id}
                onClick={() => setOpenLead(lead.id)}
                className={cn(
                  "cursor-pointer transition-colors",
                  isOpen
                    ? "bg-brand-50"
                    : isSelected
                      ? "bg-brand-50/60"
                      : overdue
                        ? "bg-red-50/50 hover:bg-red-50"
                        : "hover:bg-admin-bg",
                )}
              >
                {/* The inner span stops a checkbox click from also opening
                    the drawer. */}
                <Td>
                  <span
                    className="block"
                    onClick={(event) => event.stopPropagation()}
                    role="presentation"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggle(lead.id)}
                      aria-label={`Select ${lead.name}`}
                      className="h-3.5 w-3.5 rounded border-admin-border-strong text-brand-600 focus:ring-brand-500"
                    />
                  </span>
                </Td>

                <Td>
                  <ScorePill score={lead.score} band={lead.scoreBand} />
                </Td>

                <Td>
                  <span className="flex items-center gap-2.5">
                    <Avatar name={lead.name} size="sm" />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[13px] font-medium text-admin-text">
                          {lead.name}
                        </span>
                        {lead.priority !== "NORMAL" && lead.priority !== "LOW" && (
                          <StatusBadge tone={priorityTone(lead.priority)}>
                            <Flame className="h-2.5 w-2.5" />
                            {humanStatus(lead.priority)}
                          </StatusBadge>
                        )}
                      </span>
                      <span className="block text-[11px] text-admin-text-subtle">
                        {lead.activityCount} {lead.activityCount === 1 ? "activity" : "activities"}
                      </span>
                      {lead.tags.length > 0 && (
                        <span className="mt-0.5 flex flex-wrap gap-1">
                          {lead.tags.slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-admin-muted px-1.5 text-[10px] font-medium text-admin-text-muted"
                            >
                              {tag}
                            </span>
                          ))}
                          {lead.tags.length > 2 && (
                            <span className="text-[10px] text-admin-text-subtle">
                              +{lead.tags.length - 2}
                            </span>
                          )}
                        </span>
                      )}
                    </span>
                  </span>
                </Td>

                <Td>
                  <span className="flex flex-col gap-0.5 text-[11px]" onClick={(event) => event.stopPropagation()}>
                    <a
                      href={`tel:${lead.phone}`}
                      className="inline-flex items-center gap-1 hover:text-brand-600"
                    >
                      <Phone className="h-3 w-3 shrink-0" /> {lead.phone}
                    </a>
                    {lead.email && (
                      <a
                        href={`mailto:${lead.email}`}
                        className="inline-flex max-w-[180px] items-center gap-1 truncate hover:text-brand-600"
                      >
                        <Mail className="h-3 w-3 shrink-0" />
                        <span className="truncate">{lead.email}</span>
                      </a>
                    )}
                    {lead.whatsapp && (
                      <span className="inline-flex items-center gap-1">
                        <MessageCircle className="h-3 w-3 shrink-0" /> {lead.whatsapp}
                      </span>
                    )}
                  </span>
                </Td>

                <Td>
                  <span className="block text-[13px] text-admin-text">{lead.destination || "—"}</span>
                  {lead.budget && (
                    <span className="block text-[11px] text-admin-text-subtle">{lead.budget}</span>
                  )}
                </Td>

                <Td>
                  <span className="block text-[12px] font-medium text-admin-text-muted">
                    {leadSourceLabel(lead.source)}
                  </span>
                  {lead.campaign && (
                    <span
                      className="block max-w-[140px] truncate text-[11px] text-admin-text-subtle"
                      title={lead.campaign}
                    >
                      {lead.campaign}
                    </span>
                  )}
                </Td>

                <Td>
                  {followUp ? (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-[12px]",
                        overdue ? "font-semibold text-admin-danger" : "text-admin-text-muted",
                      )}
                    >
                      <CalendarClock className="h-3 w-3 shrink-0" />
                      {formatDate(followUp)}
                    </span>
                  ) : (
                    <span className="text-[12px] text-admin-text-subtle">—</span>
                  )}
                </Td>

                {showOwner && (
                  <Td>
                    {lead.assignedToName ? (
                      <span className="flex items-center gap-1.5">
                        <Avatar name={lead.assignedToName} size="xs" />
                        <span className="truncate text-[12px]">{lead.assignedToName}</span>
                      </span>
                    ) : (
                      <span className="text-[12px] text-admin-text-subtle">Unassigned</span>
                    )}
                  </Td>
                )}

                <Td>
                  <StatusBadge tone={leadStatusTone(lead.status)} dot>
                    {leadStatusLabel(lead.status)}
                  </StatusBadge>
                </Td>

                <Td align="right" className="whitespace-nowrap text-[12px]">
                  {formatDate(lead.createdAt)}
                </Td>
              </tr>
            );
          })}
        </Tbody>
      </TableWrap>

      <LeadDrawer leadId={openLeadId} onClose={() => setOpenLead(null)} />
    </>
  );
}
