"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarRange, RefreshCw } from "lucide-react";
import { Input, Select } from "@/components/ui/Field";
import { buttonClasses } from "@/components/admin/ui";

/**
 * Dashboard date filter.
 *
 * A plain GET form, like every other filter bar in the panel. The range
 * therefore lives in the URL and every figure on the page is recomputed on
 * the server for the selected window — a filter that only narrowed what the
 * client already had would be filtering a subset and silently misreporting
 * the rest. It also means a range can be bookmarked and shared.
 *
 * Choosing a preset submits immediately; a custom range waits for Apply,
 * since a half-typed date pair would otherwise fire a query per keystroke.
 * With JavaScript unavailable the Apply button still submits the form.
 */
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
  const formRef = React.useRef<HTMLFormElement>(null);
  const [value, setValue] = React.useState(range);
  const [refreshing, setRefreshing] = React.useState(false);

  React.useEffect(() => setValue(range), [range]);

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

  const custom = value === "custom";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form
        ref={formRef}
        method="get"
        action="/admin/dashboard"
        className="flex flex-wrap items-center gap-2"
      >
        <div className="flex items-center gap-1.5 rounded-control border border-admin bg-admin-card pl-2">
          <CalendarRange className="h-3.5 w-3.5 shrink-0 text-admin-text-subtle" aria-hidden />
          <Select
            inputSize="sm"
            name="range"
            aria-label="Date range"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              // A custom range means nothing until both dates are filled in.
              if (event.target.value !== "custom") {
                event.currentTarget.form?.requestSubmit();
              }
            }}
            className="border-0 bg-transparent pl-1 focus:ring-0"
          >
            {RANGES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>

        {/* The dates are always in the form so a custom range survives a
            submit; they are only shown when that range is selected. */}
        <div className={custom ? "flex flex-wrap items-center gap-2" : "hidden"}>
          <Input
            inputSize="sm"
            type="date"
            name="from"
            aria-label="From date"
            defaultValue={from ?? ""}
            className="w-[150px]"
          />
          <Input
            inputSize="sm"
            type="date"
            name="to"
            aria-label="To date"
            defaultValue={to ?? ""}
            className="w-[150px]"
          />
        </div>

        <button
          type="submit"
          className={custom ? buttonClasses("primary", "sm") : "sr-only"}
        >
          Apply
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setRefreshing(true);
          router.refresh();
          // The refresh resolves on the server; this just stops the spinner
          // looking stuck if it is quick.
          window.setTimeout(() => setRefreshing(false), 800);
        }}
        className={buttonClasses("outline", "sm")}
        title="Reload the figures"
      >
        <RefreshCw className={refreshing ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
        <span className="hidden sm:inline">Refresh</span>
      </button>
    </div>
  );
}
