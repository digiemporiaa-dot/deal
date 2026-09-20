"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { assignLead } from "@/app/admin/(panel)/leads/actions";
import { useToast } from "@/components/admin/Toast";

export type TeamMember = { id: string; name: string; role: string };

export function LeadAssignSelect({
  leadId,
  value,
  members,
  className = "",
}: {
  leadId: string;
  value: string | null;
  members: TeamMember[];
  className?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [current, setCurrent] = React.useState(value ?? "");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => setCurrent(value ?? ""), [value]);

  return (
    <div>
      <select
        value={current}
        disabled={pending}
        aria-label="Assign lead"
        onChange={async (e) => {
          const next = e.target.value;
          const previous = current;
          setCurrent(next);
          setPending(true);
          setError(null);
          const res = await assignLead(leadId, next);
          if (res.ok) {
            toast.success(next ? "Lead assigned." : "Lead unassigned.");
            router.refresh();
          } else {
            // Keep the select showing what the database actually holds.
            setCurrent(previous);
            setError(res.error);
            toast.error(res.error);
          }
          setPending(false);
        }}
        className={`h-9 rounded-lg border border-admin-border-strong px-2 text-sm focus:border-brand-500 focus:outline-none disabled:opacity-50 ${className}`}
      >
        <option value="">Unassigned</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
