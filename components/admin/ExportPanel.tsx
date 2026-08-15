"use client";

import * as React from "react";
import { Download, FileSpreadsheet, FileText, Database, ShieldCheck } from "lucide-react";
import { Card } from "@/components/admin/ui";
import { Input, Label, Select } from "@/components/ui/Field";

const LEAD_STATUSES = ["NEW", "CONTACTED", "FOLLOW_UP", "QUALIFIED", "CONVERTED", "LOST"];

function firstOfMonth(): string {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ExportPanel({ members }: { members: { id: string; name: string }[] }) {
  const [from, setFrom] = React.useState(firstOfMonth());
  const [to, setTo] = React.useState(today());
  const [status, setStatus] = React.useState("");
  const [owner, setOwner] = React.useState("");

  const leadUrl = (format: "csv" | "excel") => {
    const p = new URLSearchParams({ format });
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (status) p.set("status", status);
    if (owner) p.set("owner", owner);
    return `/api/admin/export/leads?${p.toString()}`;
  };

  const quick = (days: number) => {
    const start = new Date();
    start.setDate(start.getDate() - days + 1);
    setFrom(start.toISOString().slice(0, 10));
    setTo(today());
  };

  return (
    <div className="space-y-6">
      {/* Leads */}
      <Card className="p-5">
        <h2 className="font-semibold text-slate-900">Export leads</h2>
        <p className="mt-1 text-sm text-slate-500">
          Download enquiries with full follow-up history — open in Excel or Google Sheets.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { label: "Last 7 days", days: 7 },
            { label: "Last 30 days", days: 30 },
            { label: "Last 90 days", days: 90 },
            { label: "This year", days: 365 },
          ].map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => quick(q.days)}
              className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
            >
              {q.label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Assigned to</Label>
            <Select value={owner} onChange={(e) => setOwner(e.target.value)}>
              <option value="">Anyone</option>
              <option value="none">Unassigned</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </Select>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <a
            href={leadUrl("excel")}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <FileSpreadsheet className="h-4 w-4" /> Download Excel
          </a>
          <a
            href={leadUrl("csv")}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <FileText className="h-4 w-4" /> Download CSV
          </a>
        </div>
      </Card>

      {/* Other data */}
      <Card className="p-5">
        <h2 className="font-semibold text-slate-900">Export other records</h2>
        <p className="mt-1 text-sm text-slate-500">Complete lists — no date filter.</p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { type: "bookings", label: "Bookings" },
            { type: "customers", label: "Customers" },
            { type: "packages", label: "Packages" },
          ].map((item) => (
            <div key={item.type} className="rounded-xl border border-slate-200 p-4">
              <p className="font-medium text-slate-900">{item.label}</p>
              <div className="mt-3 flex gap-2">
                <a
                  href={`/api/admin/export/data?type=${item.type}&format=excel`}
                  className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
                </a>
                <a
                  href={`/api/admin/export/data?type=${item.type}&format=csv`}
                  className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <FileText className="h-3.5 w-3.5" /> CSV
                </a>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Backup */}
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-900 text-white">
            <Database className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-slate-900">Full data backup</h2>
            <p className="mt-1 text-sm text-slate-500">
              One file containing every package, page, blog, booking, customer, lead, quotation and
              invoice. Download this monthly and keep it somewhere safe — if anything ever goes wrong
              with the database, this is your safety net.
            </p>
            <a
              href="/api/admin/export/data?type=backup"
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <Download className="h-4 w-4" /> Download backup
            </a>
            <p className="mt-3 inline-flex items-start gap-1.5 text-xs text-amber-700">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              This file contains customer names, phone numbers and emails. Store it privately — never
              share it or upload it to a public place.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
