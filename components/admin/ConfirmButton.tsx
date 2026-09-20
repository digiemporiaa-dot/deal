"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/admin/Toast";

type ActionResponse = { ok: true } | { ok: false; error: string };

/**
 * A button that asks before it acts.
 *
 * Every destructive admin action goes through this: it shows a modal, keeps
 * the trigger disabled while the Server Action runs, reports the outcome as a
 * toast and refreshes the route on success. Escape closes it and focus is
 * trapped on the cancel button, so the dangerous option is never the default.
 */
export function ConfirmButton({
  onConfirm,
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  successMessage,
  tone = "danger",
  className,
  children,
  disabled,
}: {
  onConfirm: () => Promise<ActionResponse | void>;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  successMessage?: string;
  tone?: "danger" | "primary";
  className?: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const cancelRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, pending]);

  const run = async () => {
    setPending(true);
    try {
      const result = await onConfirm();
      if (result && result.ok === false) {
        toast.error(result.error);
        return;
      }
      toast.success(successMessage ?? "Done.");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className} disabled={disabled}>
        {children}
      </button>

      {mounted &&
        open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            className="fixed inset-0 z-[110] flex items-center justify-center bg-admin-navy/50 p-4"
            onClick={() => !pending && setOpen(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "grid h-10 w-10 shrink-0 place-items-center rounded-full",
                    tone === "danger" ? "bg-red-50 text-red-600" : "bg-brand-50 text-brand-600",
                  )}
                >
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2 id="confirm-title" className="font-semibold text-admin-text">
                    {title}
                  </h2>
                  {description && <p className="mt-1 text-sm text-admin-text-muted">{description}</p>}
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  ref={cancelRef}
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                  className="inline-flex h-10 items-center rounded-lg border border-admin-border-strong bg-white px-4 text-sm font-semibold text-admin-text hover:bg-admin-bg disabled:opacity-50"
                >
                  {cancelLabel}
                </button>
                <button
                  type="button"
                  onClick={run}
                  disabled={pending}
                  className={cn(
                    "inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-60",
                    tone === "danger" ? "bg-red-600 hover:bg-red-700" : "bg-brand-600 hover:bg-brand-700",
                  )}
                >
                  {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {pending ? "Working…" : confirmLabel}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
