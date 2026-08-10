"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { updateLeadStatus } from "@/app/admin/(panel)/leads/actions";

const STATUSES = ["NEW", "CONTACTED", "FOLLOW_UP", "QUALIFIED", "CONVERTED", "LOST"];

export function LeadStatusSelect({ id, value }: { id: string; value: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  return (
    <select
      value={value}
      disabled={pending}
      onChange={async (e) => {
        setPending(true);
        await updateLeadStatus(id, e.target.value);
        router.refresh();
        setPending(false);
      }}
      className="h-9 rounded-lg border border-slate-300 px-2 text-sm focus:border-brand-500 focus:outline-none"
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
      ))}
    </select>
  );
}
