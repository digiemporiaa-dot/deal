"use client";

import { Printer, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export function PrintButton({ fileName }: { fileName: string }) {
  const router = useRouter();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <div className="flex items-center gap-3">
        <span className="hidden text-xs text-slate-500 sm:inline">
          Choose &ldquo;Save as PDF&rdquo; in the print window to download {fileName}
        </span>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          <Printer className="h-4 w-4" /> Print / Save as PDF
        </button>
      </div>
    </div>
  );
}
