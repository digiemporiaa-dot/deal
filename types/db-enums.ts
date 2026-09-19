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

// CONVERTED is the "won" state; it keeps its original name because existing
// rows use it. PROPOSAL_SENT was added with the CRM upgrade.
export type LeadStatus =
  | "NEW"
  | "CONTACTED"
  | "QUALIFIED"
  | "PROPOSAL_SENT"
  | "FOLLOW_UP"
  | "CONVERTED"
  | "LOST";

export type LeadPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export type DiscountType = "PERCENTAGE" | "FIXED";

export type PostStatus = "DRAFT" | "PUBLISHED";
