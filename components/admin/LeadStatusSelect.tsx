"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { updateLeadStatus } from "@/app/admin/(panel)/leads/actions";
import { useToast } from "@/components/admin/Toast";
import { Textarea, Label } from "@/components/ui/Field";
import { buttonClasses } from "@/components/admin/ui";
import { LEAD_STATUSES, leadStatusLabel, WON_STATUS } from "@/lib/crm";

const LOSS_REASONS = [
  "Too expensive",
  "Went with another operator",
  "Trip postponed",
  "Changed plans",
  "No response",
  "Not a genuine enquiry",
];

/**
 * Inline status change.
 *
 * The select reverts to the previous value when the Server Action refuses the
 * change, so the control never shows a status the database does not hold.
 *
 * Two statuses ask first, because both do more than change a word:
 *   Lost — the server requires a reason, so this collects one rather than
 *          letting the person hit an error after the fact.
 *   Won  — creates or links a customer record, which is not something to do
 *          by brushing past an option in a dropdown.
 */
export function LeadStatusSelect({ id, value }: { id: string; value: string }) {
  const router = useRouter();
  const toast = useToast();
  const [current, setCurrent] = React.useState(value);
  const [pending, setPending] = React.useState(false);
  const [confirming, setConfirming] = React.useState<string | null>(null);
  const [reason, setReason] = React.useState("");

  React.useEffect(() => setCurrent(value), [value]);

  async function apply(next: string, why?: string) {
    const previous = current;
    setCurrent(next);
    setPending(true);
    try {
      const result = await updateLeadStatus(id, next, why);
      if (result.ok) {
        toast.success(
          result.customerId
            ? "Converted — the customer record is linked."
            : `Moved to ${leadStatusLabel(next)}.`,
        );
        setConfirming(null);
        setReason("");
        router.refresh();
      } else {
        setCurrent(previous);
        toast.error(result.error);
      }
    } catch {
      setCurrent(previous);
      toast.error("Could not update the status. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative">
      <select
        value={current}
        disabled={pending}
        aria-label="Lead status"
        onChange={(event) => {
          const next = event.target.value;
          if (next === current) return;
          if (next === "LOST" || next === WON_STATUS) {
            // Hold the select on its current value until the prompt is
            // answered, so a cancel leaves nothing half-changed.
            event.target.value = current;
            setReason("");
            setConfirming(next);
            return;
          }
          void apply(next);
        }}
        className="h-9 rounded-lg border border-admin-border-strong px-2 text-sm focus:border-brand-500 focus:outline-none disabled:opacity-60"
      >
        {LEAD_STATUSES.map((status) => (
          <option key={status} value={status}>
            {leadStatusLabel(status)}
          </option>
        ))}
      </select>

      {confirming && (
        <div
          role="dialog"
          aria-label={confirming === "LOST" ? "Why was this lead lost?" : "Convert this lead"}
          className="absolute right-0 top-11 z-30 w-[320px] rounded-card border border-admin bg-admin-card p-4 shadow-lg"
        >
          {confirming === "LOST" ? (
            <>
              <Label htmlFor="loss-reason">Why was this lead lost?</Label>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {LOSS_REASONS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setReason(preset)}
                    className="rounded-full border border-admin-border-strong px-2 py-0.5 text-xs text-admin-text-muted hover:border-brand-400 hover:text-brand-700"
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <Textarea
                id="loss-reason"
                rows={2}
                maxLength={500}
                value={reason}
                placeholder="A sentence is enough."
                onChange={(event) => setReason(event.target.value)}
              />
              <p className="mt-1 text-xs text-admin-text-muted">
                Recorded on the lead so lost business can be reported on.
              </p>
            </>
          ) : (
            <p className="text-sm text-admin-text">
              This creates a customer record, or links this lead to the existing one with the same
              phone or email. Any pending follow-ups are stood down.
            </p>
          )}

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={pending || (confirming === "LOST" && !reason.trim())}
              onClick={() => void apply(confirming, reason.trim() || undefined)}
              className={buttonClasses("primary", "sm")}
            >
              {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {confirming === "LOST" ? "Mark lost" : "Convert"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setConfirming(null);
                setReason("");
              }}
              className={buttonClasses("ghost", "sm")}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
