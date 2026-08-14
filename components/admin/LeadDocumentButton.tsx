"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { createDocumentFromLead } from "@/app/admin/(panel)/quotations/actions";

export function LeadDocumentButton({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          const res = await createDocumentFromLead(leadId, "QUOTATION");
          if (res.ok) router.push(`/admin/quotations/${res.id}`);
          else {
            setError(res.error);
            setPending(false);
          }
        }}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-brand-300 bg-brand-50 px-4 text-sm font-semibold text-brand-700 hover:bg-brand-100 disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
        {pending ? "Creating…" : "Create quotation"}
      </button>
      <p className="mt-2 text-xs text-slate-500">Prefills the customer&rsquo;s details — you just add prices.</p>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
