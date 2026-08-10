"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Log to the server console; never expose stack traces to customers.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-bold text-slate-900">Something went wrong</h1>
      <p className="mt-2 max-w-md text-slate-600">
        An unexpected error occurred. Please try again — if the problem persists, contact our team.
      </p>
      <button
        onClick={reset}
        className="mt-6 inline-flex h-11 items-center rounded-lg bg-brand-600 px-6 text-sm font-semibold text-white hover:bg-brand-700"
      >
        Try again
      </button>
    </div>
  );
}
