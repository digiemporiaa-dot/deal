import Link from "next/link";
import { Phone, Mail, MessageCircle } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader, Card, EmptyState } from "@/components/admin/ui";
import { formatDate } from "@/lib/utils";
import { LeadStatusSelect } from "@/components/admin/LeadStatusSelect";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const where: Prisma.LeadWhereInput = {};
  if (sp.status) where.status = sp.status as Prisma.LeadWhereInput["status"];
  if (sp.q) where.OR = [
    { name: { contains: sp.q } },
    { phone: { contains: sp.q } },
    { destination: { contains: sp.q } },
  ];

  const leads = await prisma.lead.findMany({ where, orderBy: { createdAt: "desc" } });

  return (
    <div>
      <PageHeader title="Leads & Enquiries" description="Track and follow up with potential customers" />

      <Card className="mb-4 p-3">
        <form className="flex flex-wrap gap-2">
          <input name="q" defaultValue={sp.q} placeholder="Search name, phone, destination…" className="h-10 min-w-[220px] flex-1 rounded-lg border border-slate-300 px-3 text-sm focus:border-brand-500 focus:outline-none" />
          <select name="status" defaultValue={sp.status} className="h-10 rounded-lg border border-slate-300 px-3 text-sm">
            <option value="">All statuses</option>
            {["NEW", "CONTACTED", "FOLLOW_UP", "QUALIFIED", "CONVERTED", "LOST"].map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </select>
          <button className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800">Filter</button>
        </form>
      </Card>

      {leads.length === 0 ? (
        <EmptyState title="No leads yet" description="Enquiries submitted from the website appear here." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Destination</th>
                  <th className="px-4 py-3">Received</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leads.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50">
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
                    <td className="px-4 py-3"><LeadStatusSelect id={l.id} value={l.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/leads/${l.id}`} className="text-sm font-semibold text-brand-600 hover:underline">Open</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
