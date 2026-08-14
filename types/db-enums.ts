// String-literal unions mirroring the enums the schema used under PostgreSQL.
// SQLite has no native enums, so these columns are plain `String`; import these
// aliases where a narrow type is helpful (validation lists, tone maps, etc.).

export type UserRole =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "CONTENT_MANAGER"
  | "BOOKING_MANAGER"
  | "SALES_EXECUTIVE";

export type BookingStatus =
  | "PENDING"
  | "PAYMENT_PENDING"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "REFUNDED";

export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED" | "PARTIALLY_REFUNDED";

export type LeadStatus = "NEW" | "CONTACTED" | "FOLLOW_UP" | "QUALIFIED" | "CONVERTED" | "LOST";

export type DiscountType = "PERCENTAGE" | "FIXED";

export type PostStatus = "DRAFT" | "PUBLISHED";
