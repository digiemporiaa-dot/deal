"use client";

import * as React from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

/**
 * Admin error boundary. `digest` is the only detail shown — it is the id Next
 * puts in the server log, so support can find the real error without it being
 * printed on screen.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-10 text-center">
      <AlertTriangle className="mx-auto h-8 w-8 text-red-500" />
      <h1 className="mt-3 text-lg font-semibold text-red-900">This page could not be loaded</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-red-700">
        The problem has been logged. Try again — if it keeps happening, send the reference below to
        whoever maintains the site.
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-xs text-red-500">Reference: {error.digest}</p>
      )}
      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex h-10 items-center gap-2 rounded-lg bg-red-600 px-5 text-sm font-semibold text-white hover:bg-red-700"
      >
        <RotateCw className="h-4 w-4" /> Try again
      </button>
    </div>
  );
}
