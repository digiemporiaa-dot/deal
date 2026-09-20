"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { updateLeadStatus } from "@/app/admin/(panel)/leads/actions";
import { useToast } from "@/components/admin/Toast";
import { LEAD_STATUSES, leadStatusLabel } from "@/lib/crm";

/**
 * Inline status change. The select reverts to the previous value when the
 * Server Action refuses the change, so the row never shows a status the
 * database does not actually hold.
 */
export function LeadStatusSelect({ id, value }: { id: string; value: string }) {
  const router = useRouter();
  const toast = useToast();
  const [current, setCurrent] = React.useState(value);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => setCurrent(value), [value]);

  return (
    <select
      value={current}
      disabled={pending}
      aria-label="Lead status"
      onChange={async (event) => {
        const next = event.target.value;
        const previous = current;
        setCurrent(next);
        setPending(true);
        try {
          const result = await updateLeadStatus(id, next);
          if (result.ok) {
            toast.success(`Moved to ${leadStatusLabel(next)}.`);
            router.refresh();
          } else {
            setCurrent(previous);
            toast.error(result.error);
          }
        } catch {
          setCurrent(previous);
          toast.error("Could not update the status. Please try again.");
        } finally {
          setPending(false);
        }
      }}
      className="h-9 rounded-lg border border-admin-border-strong px-2 text-sm focus:border-brand-500 focus:outline-none disabled:opacity-60"
    >
      {LEAD_STATUSES.map((status) => (
        <option key={status} value={status}>
          {leadStatusLabel(status)}
        </option>
      ))}
    </select>
  );
}
