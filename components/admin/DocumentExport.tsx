"use client";

import * as React from "react";
import { Download, ChevronDown } from "lucide-react";
import { Label, Select, controlClasses } from "@/components/ui/Field";
import { buttonClasses } from "@/components/admin/ui";
import { DOC_LABEL, DOC_STATUSES, type DocKind } from "@/lib/documents-shared";
import { cn } from "@/lib/utils";

/**
 * Bulk download for the accounts team.
 *
 * Collapsed to a single button until it is wanted, because an invoice list is
 * read far more often than it is exported. Opening it shows the choices that
 * actually change the file: which dates, which status, and whether accounts
 * want one row per invoice or one row per line.
 *
 * It is a plain link rather than fetch-and-blob so the browser handles the
 * download itself — and so the same URL can be bookmarked, or called from a
 * script, by anyone who holds the permission.
 */
export function DocumentExport({ kind }: { kind: DocKind }) {
  const [open, setOpen] = React.useState(false);
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [detail, setDetail] = React.useState<"summary" | "items">("summary");

  const label = DOC_LABEL[kind];

  const href = React.useMemo(() => {
    const params = new URLSearchParams({ kind, detail });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (status) params.set("status", status);
    return `/api/admin/export/invoices?${params.toString()}`;
  }, [kind, detail, from, to, status]);

  const invalidRange = Boolean(from && to && from > to);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={buttonClasses("outline", "sm")}
      >
        <Download className="h-4 w-4" />
        Export
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="mt-3 rounded-2xl border border-admin bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label htmlFor="export-from">From</Label>
              <input
                id="export-from"
                type="date"
                value={from}
                max={to || undefined}
                onChange={(event) => setFrom(event.target.value)}
                className={controlClasses("sm", "w-full")}
              />
            </div>
            <div>
              <Label htmlFor="export-to">To</Label>
              <input
                id="export-to"
                type="date"
                value={to}
                min={from || undefined}
                onChange={(event) => setTo(event.target.value)}
                className={controlClasses("sm", "w-full")}
              />
            </div>
            <div>
              <Label htmlFor="export-status">Status</Label>
              <Select
                id="export-status"
                inputSize="sm"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="">Every status</option>
                {DOC_STATUSES[kind].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="export-detail">Rows</Label>
              <Select
                id="export-detail"
                inputSize="sm"
                value={detail}
                onChange={(event) => setDetail(event.target.value as "summary" | "items")}
              >
                <option value="summary">One row per {label.one.toLowerCase()}</option>
                <option value="items">One row per line item</option>
              </Select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <a
              href={invalidRange ? undefined : `${href}&format=csv`}
              aria-disabled={invalidRange}
              className={cn(buttonClasses("primary", "sm"), invalidRange && "pointer-events-none opacity-50")}
            >
              <Download className="h-4 w-4" /> Download CSV
            </a>
            <a
              href={invalidRange ? undefined : `${href}&format=excel`}
              aria-disabled={invalidRange}
              className={cn(buttonClasses("outline", "sm"), invalidRange && "pointer-events-none opacity-50")}
            >
              <Download className="h-4 w-4" /> Download Excel
            </a>
            {(from || to || status) && (
              <button
                type="button"
                onClick={() => { setFrom(""); setTo(""); setStatus(""); }}
                className="text-xs font-medium text-admin-text-muted hover:text-admin-text"
              >
                Clear filters
              </button>
            )}
          </div>

          <p className="mt-2 text-xs text-admin-text-muted">
            {invalidRange
              ? "The start date is after the end date."
              : from || to
                ? `Covers ${label.many.toLowerCase()} raised ${from ? `from ${from}` : "up"}${to ? ` to ${to}` : " to today"}, inclusive.`
                : `Covers every ${label.one.toLowerCase()} ever raised. Set a date range to narrow it.`}
          </p>
        </div>
      )}
    </div>
  );
}
