import Link from "next/link";
import { Users } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";

export type DuplicateSummary = {
  id: string;
  name: string;
  statusLabel: string;
  assignedToName: string | null;
  matchedOn: ("phone" | "email")[];
  createdAt: string;
};

/**
 * "You already have this person."
 *
 * Shown, never enforced. A repeat customer filling the form again is good
 * news, and a CRM that refuses the second enquiry loses the business. What
 * matters is that whoever picks it up knows a colleague may already be on it
 * — so the owner is named, which is the fact that stops two people calling
 * the same customer an hour apart.
 */
export function LeadDuplicateWarning({
  duplicates,
  className,
  compact,
}: {
  duplicates: DuplicateSummary[];
  className?: string;
  compact?: boolean;
}) {
  if (duplicates.length === 0) return null;

  return (
    <div
      className={cn(
        "rounded-control border border-amber-200 bg-amber-50 p-3 text-amber-900",
        className,
      )}
      role="status"
    >
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <Users className="h-4 w-4 shrink-0" />
        {duplicates.length === 1
          ? "This contact is already in the CRM"
          : `This contact matches ${duplicates.length} existing enquiries`}
      </p>

      <ul className={cn("mt-2 space-y-1 text-sm", compact && "text-xs")}>
        {duplicates.map((duplicate) => (
          <li key={duplicate.id}>
            <Link
              href={`/admin/leads/${duplicate.id}`}
              className="font-medium underline underline-offset-2 hover:text-amber-700"
            >
              {duplicate.name}
            </Link>{" "}
            <span className="text-amber-800">
              — {duplicate.statusLabel}
              {duplicate.assignedToName ? `, with ${duplicate.assignedToName}` : ", unassigned"}
              {" · "}
              {formatDate(new Date(duplicate.createdAt))}
              {duplicate.matchedOn.length > 0 && ` · same ${duplicate.matchedOn.join(" and ")}`}
            </span>
          </li>
        ))}
      </ul>

      <p className={cn("mt-2 text-xs text-amber-800", compact && "hidden")}>
        Check with the owner before calling, so the customer does not hear from two of you.
      </p>
    </div>
  );
}
