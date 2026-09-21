import type { BadgeTone } from "@/components/admin/ui";

/**
 * Domain status → badge colour.
 *
 * Kept in one place because the same word means different things in different
 * tables: a PENDING booking is simply new, while a PENDING payment is money
 * still outstanding. Letting each page guess is how a dashboard ends up with
 * the same status in three colours.
 */

const LEAD_TONES: Record<string, BadgeTone> = {
  NEW: "blue",
  CONTACTED: "amber",
  QUALIFIED: "purple",
  PROPOSAL_SENT: "brand",
  NEGOTIATION: "brand",
  FOLLOW_UP: "amber",
  CONVERTED: "green",
  LOST: "red",
  // Junk is closed but not a loss — grey, so it reads as "ignore" rather
  // than "we failed".
  JUNK: "slate",
};

/** HOT / WARM / COLD → badge colour. */
const SCORE_TONES: Record<string, BadgeTone> = {
  HOT: "red",
  WARM: "amber",
  COLD: "slate",
};

export function scoreBandTone(band: string): BadgeTone {
  return SCORE_TONES[band] ?? "slate";
}

export function leadStatusTone(status: string): BadgeTone {
  return LEAD_TONES[status] ?? "slate";
}

const BOOKING_TONES: Record<string, BadgeTone> = {
  PENDING: "slate",
  CONFIRMED: "green",
  IN_PROGRESS: "brand",
  COMPLETED: "green",
  CANCELLED: "red",
};

export function bookingStatusTone(status: string): BadgeTone {
  return BOOKING_TONES[status] ?? "slate";
}

const PAYMENT_TONES: Record<string, BadgeTone> = {
  PENDING: "amber",
  PARTIAL: "amber",
  PAID: "green",
  FAILED: "red",
  REFUNDED: "purple",
  PARTIALLY_REFUNDED: "purple",
  CREATED: "slate",
};

export function paymentStatusTone(status: string): BadgeTone {
  return PAYMENT_TONES[status] ?? "slate";
}

const PRIORITY_TONES: Record<string, BadgeTone> = {
  URGENT: "red",
  HIGH: "amber",
  NORMAL: "slate",
  LOW: "slate",
};

export function priorityTone(priority: string): BadgeTone {
  return PRIORITY_TONES[priority] ?? "slate";
}

/** Published/draft, used by every content table. */
export function publishTone(published: boolean): BadgeTone {
  return published ? "green" : "slate";
}

/** Turn an UPPER_SNAKE status into something readable. */
export function humanStatus(status: string): string {
  return status
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^./, (character) => character.toUpperCase());
}
