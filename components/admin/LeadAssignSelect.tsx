"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { assignLead } from "@/app/admin/(panel)/leads/actions";

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
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  return (
    <div>
      <select
        value={value ?? ""}
        disabled={pending}
        onChange={async (e) => {
          setPending(true);
          setError(null);
          const res = await assignLead(leadId, e.target.value);
          if (!res.ok) setError(res.error);
          router.refresh();
          setPending(false);
        }}
        className={`h-9 rounded-lg border border-slate-300 px-2 text-sm focus:border-brand-500 focus:outline-none disabled:opacity-50 ${className}`}
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
