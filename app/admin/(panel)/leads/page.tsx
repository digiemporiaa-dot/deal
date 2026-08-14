import Link from "next/link";
import { Phone, Mail, MessageCircle, CalendarClock } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader, Card, EmptyState } from "@/components/admin/ui";
import { formatDate } from "@/lib/utils";
import { LeadStatusSelect } from "@/components/admin/LeadStatusSelect";
import { LeadAssignSelect } from "@/components/admin/LeadAssignSelect";
import { auth } from "@/lib/auth";
import { isLeadOwnerOnly, canAssignLeads } from "@/lib/permissions";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const STATUS_LIST = ["NEW", "CONTACTED", "FOLLOW_UP", "QUALIFIED", "CONVERTED", "LOST"];

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; due?: string; owner?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  const myId = session?.user?.id ?? "";
  const role = (session?.user as { role?: string } | undefined)?.role;
  const ownLeadsOnly = isLeadOwnerOnly(role);
  const mayAssign = canAssignLeads(role);
  const where: Prisma.LeadWhereInput = {};
  if (sp.status) where.status = sp.status as Prisma.LeadWhereInput["status"];
  if (sp.q) where.OR = [
    { name: { contains: sp.q } },
    { phone: { contains: sp.q } },
    { destination: { contains: sp.q } },
  ];

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  if (sp.due === "1") where.nextFollowUpAt = { not: null, lte: endOfToday };
  if (ownLeadsOnly) {
    // Sales executives can only ever see their own leads, whatever the URL says.
    where.assignedToId = myId || "__none__";
  } else {
    if (sp.owner === "me" && myId) where.assignedToId = myId;
    if (sp.owner === "none") where.assignedToId = null;
  }
  const scope: Prisma.LeadWhereInput = ownLeadsOnly ? { assignedToId: myId || "__none__" } : {};

  const [leads, counts, dueCount, myCount, members] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: [{ nextFollowUpAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
      include: { _count: { select: { notes: true } }, assignedTo: { select: { id: true, name: true } } },
    }),
    prisma.lead.groupBy({ by: ["status"], where: scope, _count: { _all: true } }),
    prisma.lead.count({ where: { ...scope, nextFollowUpAt: { not: null, lte: endOfToday } } }),
    myId ? prisma.lead.count({ where: { assignedToId: myId } }) : Promise.resolve(0),
    mayAssign
      ? prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true, role: true }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
  ]);

  const countFor = (status: string) => counts.find((c) => c.status === status)?._count._all ?? 0;

  return (
    <div>
      <PageHeader
        title={ownLeadsOnly ? "My Leads" : "Leads & Enquiries"}
        description={ownLeadsOnly ? "Enquiries assigned to you — follow up and close them" : "Track and follow up with potential customers"}
      />

      {/* Pipeline summary */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7 xl:grid-cols-8">
        {STATUS_LIST.map((s) => (
          <Link
            key={s}
            href={`/admin/leads?status=${s}`}
            className="rounded-xl border border-slate-200 bg-white p-3 text-center transition-colors hover:border-brand-300 hover:bg-brand-50"
          >
            <p className="text-lg font-bold text-slate-900">{countFor(s)}</p>
            <p className="text-xs font-medium text-slate-500">{s.replace(/_/g, " ")}</p>
          </Link>
        ))}
        {!ownLeadsOnly && (
          <Link
            href="/admin/leads?owner=me"
            className="rounded-xl border border-slate-200 bg-white p-3 text-center transition-colors hover:border-brand-300 hover:bg-brand-50"
          >
            <p className="text-lg font-bold text-slate-900">{myCount}</p>
            <p className="text-xs font-medium text-slate-500">MY LEADS</p>
          </Link>
        )}
        <Link
          href="/admin/leads?due=1"
          className={`rounded-xl border p-3 text-center transition-colors ${
            dueCount > 0 ? "border-red-300 bg-red-50 hover:bg-red-100" : "border-slate-200 bg-white hover:bg-slate-50"
          }`}
        >
          <p className={`text-lg font-bold ${dueCount > 0 ? "text-red-700" : "text-slate-900"}`}>{dueCount}</p>
          <p className={`text-xs font-medium ${dueCount > 0 ? "text-red-600" : "text-slate-500"}`}>DUE TODAY</p>
        </Link>
      </div>

      <Card className="mb-4 p-3">
        <form className="flex flex-wrap gap-2">
          <input name="q" defaultValue={sp.q} placeholder="Search name, phone, destination…" className="h-10 min-w-[220px] flex-1 rounded-lg border border-slate-300 px-3 text-sm focus:border-brand-500 focus:outline-none" />
          <select name="status" defaultValue={sp.status} className="h-10 rounded-lg border border-slate-300 px-3 text-sm">
            <option value="">All statuses</option>
            {STATUS_LIST.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </select>
          <select name="due" defaultValue={sp.due} className="h-10 rounded-lg border border-slate-300 px-3 text-sm">
            <option value="">All leads</option>
            <option value="1">Follow-up due</option>
          </select>
          {!ownLeadsOnly && (
            <select name="owner" defaultValue={sp.owner} className="h-10 rounded-lg border border-slate-300 px-3 text-sm">
              <option value="">Anyone</option>
              <option value="me">Assigned to me</option>
              <option value="none">Unassigned</option>
            </select>
          )}
          <button className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800">Filter</button>
        </form>
      </Card>

      {leads.length === 0 ? (
        <EmptyState
        title={ownLeadsOnly ? "No leads assigned to you yet" : "No leads found"}
        description={ownLeadsOnly ? "Your manager will assign enquiries to you — they will appear here." : "Enquiries submitted from the website appear here."}
      />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Destination</th>
                  <th className="px-4 py-3">Received</th>
                  <th className="px-4 py-3">Follow-up</th>
                  {!ownLeadsOnly && <th className="px-4 py-3">Assigned to</th>}
                  <th className="px-4 py-3">Activity</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leads.map((l) => {
                  const overdue = l.nextFollowUpAt ? new Date(l.nextFollowUpAt) <= endOfToday : false;
                  return (
                    <tr key={l.id} className={overdue ? "bg-red-50/60 hover:bg-red-50" : "hover:bg-slate-50"}>
                      <td className="px-4 py-3 font-medium text-slate-900">{l.name}</td>
                      <td className="px-4 py-3 text-slate-600">
                        <div className="flex flex-col gap-0.5 text-xs">
                          <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {l.phone}</span>
                          {l.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> {l.email}</span>}
                          {l.whatsapp && <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {l.whatsapp}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{l.destination || "—"}</td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(l.createdAt)}</td>
                      <td className="px-4 py-3">
                        {l.nextFollowUpAt ? (
                          <span className={`inline-flex items-center gap-1 text-xs font-medium ${overdue ? "text-red-600" : "text-slate-600"}`}>
                            <CalendarClock className="h-3 w-3" /> {formatDate(l.nextFollowUpAt)}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      {!ownLeadsOnly && (
                        <td className="px-4 py-3">
                          {mayAssign ? (
                            <LeadAssignSelect leadId={l.id} value={l.assignedToId} members={members} />
                          ) : (
                            <span className="text-xs text-slate-500">{l.assignedTo?.name ?? "—"}</span>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3 text-xs text-slate-500">{l._count.notes} entries</td>
                      <td className="px-4 py-3"><LeadStatusSelect id={l.id} value={l.status} /></td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/admin/leads/${l.id}`} className="text-sm font-semibold text-brand-600 hover:underline">Open</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
