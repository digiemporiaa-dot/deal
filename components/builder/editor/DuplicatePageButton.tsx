"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2 } from "lucide-react";
import { useToast } from "@/components/admin/Toast";
import { duplicatePage } from "@/app/admin/(panel)/pages/builder-actions";

/** Copies a page, including its builder content, as a new draft. */
export function DuplicatePageButton({ pageId }: { pageId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = React.useState(false);

  return (
    <button
      type="button"
      title="Duplicate this page"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          const result = await duplicatePage(pageId);
          if (result.ok) {
            toast.success("Page duplicated as a draft.");
            router.push(`/admin/pages/${result.id}/builder`);
          } else {
            toast.error(result.error);
          }
        } finally {
          setPending(false);
        }
      }}
      className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}
