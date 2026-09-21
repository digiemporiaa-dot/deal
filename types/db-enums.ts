// String-literal unions for the columns the schema stores as `String`.
// Import these aliases where a narrow type is helpful (validation lists,
// tone maps, status selects and so on).

// Roles are defined in lib/permissions.ts, which is the source of truth.
export type { Role as UserRole } from "@/lib/permissions";

export type BookingStatus =
  | "PENDING"
  | "PAYMENT_PENDING"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "REFUNDED";

export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED" | "PARTIALLY_REFUNDED";

// CONVERTED is the "won" state and PROPOSAL_SENT the proposal stage; both keep
// their original names because existing rows use them (the UI labels them
// "Won" and "Proposal"). NEGOTIATION and JUNK were added with the CRM upgrade.
export type LeadStatus =
  | "NEW"
  | "CONTACTED"
  | "QUALIFIED"
  | "PROPOSAL_SENT"
  | "NEGOTIATION"
  | "FOLLOW_UP"
  | "CONVERTED"
  | "LOST"
  | "JUNK";

/** How warm a lead is, derived from its score. */
export type LeadScoreBand = "HOT" | "WARM" | "COLD";

/** What a scheduled follow-up task is. */
export type FollowUpType = "CALL" | "WHATSAPP" | "EMAIL" | "MEETING" | "TASK";

export type FollowUpStatus = "PENDING" | "DONE" | "CANCELLED";

export type LeadPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export type DiscountType = "PERCENTAGE" | "FIXED";

export type PostStatus = "DRAFT" | "PUBLISHED";
