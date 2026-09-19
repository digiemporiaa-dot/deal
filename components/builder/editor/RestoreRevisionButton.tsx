"use client";

import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { restoreRevision } from "@/app/admin/(panel)/pages/builder-actions";

/** Puts an earlier revision back into the draft, after a confirmation. */
export function RestoreRevisionButton({
  pageId,
  revisionId,
  version,
}: {
  pageId: string;
  revisionId: string;
  version: number;
}) {
  const router = useRouter();

  return (
    <ConfirmButton
      onConfirm={async () => {
        const result = await restoreRevision(pageId, revisionId);
        if (result.ok) router.push(`/admin/pages/${pageId}/builder`);
        return result;
      }}
      title={`Restore version ${version}?`}
      description="This replaces the current draft. Your existing draft is saved as a new revision first, so nothing is lost, and the live page does not change until you publish."
      confirmLabel="Restore"
      successMessage="Revision restored into the draft."
      tone="primary"
      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
    >
      <RotateCcw className="h-4 w-4" /> Restore
    </ConfirmButton>
  );
}
