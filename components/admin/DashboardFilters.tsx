"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarRange, RefreshCw } from "lucide-react";
import { Input, Select } from "@/components/ui/Field";
import { buttonClasses } from "@/components/admin/ui";

/**
 * Dashboard date filter.
 *
 * The range lives in the URL, so every figure on the page is recomputed on
 * the server for the selected window — a filter that only changed what the
 * client already had would be filtering a subset of the data and silently
 * lying about the rest. It also means a range can be bookmarked and shared.
 *
 * Presets apply on change; a custom range waits for Apply, since a half-typed
 * date pair would otherwise fire a query per keystroke.
 */

const RANGES = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "90d", label: "Last 90 days" },
  { value: "year", label: "This year" },
  { value: "all", label: "All time" },
  { value: "custom", label: "Custom range" },
];

export function DashboardFilters({
  range,
  from,
  to,
}: {
  range: string;
  from?: string;
  to?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = React.useTransition();

  const [value, setValue] = React.useState(range);
  const [fromDate, setFromDate] = React.useState(from ?? "");
  const [toDate, setToDate] = React.useState(to ?? "");

  const push = React.useCallback(
    (next: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, item] of Object.entries(next)) {
        if (item) params.set(key, item);
        else params.delete(key);
      }
      startTransition(() => router.push(`/admin/dashboard?${params.toString()}`));
    },
    [router, searchParams],
  );

  const onRangeChange = (next: string) => {
    setValue(next);
    // A custom range needs both dates before it means anything.
    if (next === "custom") return;
    push({ range: next, from: undefined, to: undefined });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 rounded-control border border-admin bg-admin-card px-2">
        <CalendarRange className="h-3.5 w-3.5 shrink-0 text-admin-text-subtle" aria-hidden />
        <Select
          inputSize="sm"
          aria-label="Date range"
          value={value}
          onChange={(event) => onRangeChange(event.target.value)}
          className="border-0 bg-transparent px-1 focus:ring-0"
        >
          {RANGES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      {value === "custom" && (
        <>
          <Input
            inputSize="sm"
            type="date"
            aria-label="From date"
            value={fromDate}
            max={toDate || undefined}
            onChange={(event) => setFromDate(event.target.value)}
            className="w-[150px]"
          />
          <Input
            inputSize="sm"
            type="date"
            aria-label="To date"
            value={toDate}
            min={fromDate || undefined}
            onChange={(event) => setToDate(event.target.value)}
            className="w-[150px]"
          />
          <button
            type="button"
            disabled={!fromDate || !toDate || pending}
            onClick={() => push({ range: "custom", from: fromDate, to: toDate })}
            className={buttonClasses("primary", "sm")}
          >
            Apply
          </button>
        </>
      )}

      <button
        type="button"
        onClick={() => startTransition(() => router.refresh())}
        className={buttonClasses("outline", "sm")}
        title="Reload the figures"
      >
        <RefreshCw className={pending ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
        <span className="hidden sm:inline">{pending ? "Updating…" : "Refresh"}</span>
      </button>
    </div>
  );
}
