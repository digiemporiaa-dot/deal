"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { updateLeadPriority } from "@/app/admin/(panel)/leads/actions";
import { useToast } from "@/components/admin/Toast";
import { LEAD_PRIORITIES } from "@/lib/crm";

const LABELS: Record<string, string> = {
  LOW: "Low — no rush",
  NORMAL: "Normal",
  HIGH: "High — chase today",
  URGENT: "Urgent — call now",
};

/** Sets how urgent a lead is; the CRM list can then be filtered by it. */
export function LeadPrioritySelect({ leadId, value }: { leadId: string; value: string }) {
  const router = useRouter();
  const toast = useToast();
  const [current, setCurrent] = React.useState(value);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => setCurrent(value), [value]);

  return (
    <select
      value={current}
      disabled={pending}
      aria-label="Lead priority"
      onChange={async (event) => {
        const next = event.target.value;
        const previous = current;
        setCurrent(next);
        setPending(true);
        const result = await updateLeadPriority(leadId, next);
        if (result.ok) {
          toast.success("Priority updated.");
          router.refresh();
        } else {
          setCurrent(previous);
          toast.error(result.error);
        }
        setPending(false);
      }}
      className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-brand-500 focus:outline-none disabled:opacity-60"
    >
      {LEAD_PRIORITIES.map((priority) => (
        <option key={priority} value={priority}>
          {LABELS[priority] ?? priority}
        </option>
      ))}
    </select>
  );
}
