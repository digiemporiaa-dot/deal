import { describe, it, expect } from "vitest";
import {
  QUEUE_BUCKETS,
  BUCKET_LABELS,
  ESCALATION_DAYS,
  dayEdges,
  bucketFor,
  daysLate,
  isEscalated,
} from "@/lib/crm";

/**
 * Follow-up urgency.
 *
 * All of this is arithmetic on dates, which is exactly where off-by-one
 * mistakes hide: a task due at 5pm yesterday must read as late this morning,
 * and one due at 11pm tonight must not. Every case below is fixed to a known
 * instant so the result cannot depend on when the suite happens to run.
 */

// A Tuesday, mid-afternoon.
const NOW = new Date("2026-09-22T15:30:00");
const edges = dayEdges(NOW);

const at = (iso: string) => new Date(iso);

describe("day edges", () => {
  it("bounds today from midnight to the last millisecond", () => {
    expect(edges.startOfToday.getHours()).toBe(0);
    expect(edges.startOfToday.getMinutes()).toBe(0);
    expect(edges.endOfToday.getHours()).toBe(23);
    expect(edges.endOfToday.getMilliseconds()).toBe(999);
    expect(edges.startOfToday.getDate()).toBe(22);
    expect(edges.endOfToday.getDate()).toBe(22);
  });

  it("puts tomorrow one day out and the week seven", () => {
    expect(edges.endOfTomorrow.getDate()).toBe(23);
    expect(edges.endOfWeek.getDate()).toBe(29);
  });
});

describe("bucketing", () => {
  it("counts anything before midnight today as overdue", () => {
    expect(bucketFor(at("2026-09-21T17:00:00"), edges)).toBe("overdue");
    expect(bucketFor(at("2026-09-22T00:00:00"), edges)).toBe("today");
  });

  it("keeps the whole of today in today, including late tonight", () => {
    expect(bucketFor(at("2026-09-22T09:00:00"), edges)).toBe("today");
    // Earlier today but already past — still today's work, not overdue.
    expect(bucketFor(at("2026-09-22T09:00:00"), edges)).not.toBe("overdue");
    expect(bucketFor(at("2026-09-22T23:59:59"), edges)).toBe("today");
  });

  it("separates tomorrow from the rest of the week", () => {
    expect(bucketFor(at("2026-09-23T08:00:00"), edges)).toBe("tomorrow");
    expect(bucketFor(at("2026-09-23T23:59:59"), edges)).toBe("tomorrow");
    expect(bucketFor(at("2026-09-24T00:00:01"), edges)).toBe("week");
    expect(bucketFor(at("2026-09-29T23:59:59"), edges)).toBe("week");
    expect(bucketFor(at("2026-09-30T00:00:01"), edges)).toBe("later");
  });

  it("puts every due date in exactly one bucket", () => {
    const samples = [
      "2026-08-01T10:00:00",
      "2026-09-21T23:59:59",
      "2026-09-22T00:00:00",
      "2026-09-22T23:59:59",
      "2026-09-23T12:00:00",
      "2026-09-26T12:00:00",
      "2027-01-01T12:00:00",
    ];
    for (const sample of samples) {
      const bucket = bucketFor(at(sample), edges);
      expect(QUEUE_BUCKETS).toContain(bucket);
      expect(BUCKET_LABELS[bucket]).toBeTruthy();
    }
  });
});

describe("how late", () => {
  it("reads yesterday evening as one day late, not zero", () => {
    // Only a few hours have elapsed, but a person would say "that was due
    // yesterday" — the count is in calendar days, not hours.
    expect(daysLate(at("2026-09-21T17:00:00"), edges)).toBe(1);
  });

  it("is zero for anything not yet overdue", () => {
    expect(daysLate(at("2026-09-22T09:00:00"), edges)).toBe(0);
    expect(daysLate(at("2026-09-22T23:00:00"), edges)).toBe(0);
    expect(daysLate(at("2026-09-30T09:00:00"), edges)).toBe(0);
  });

  it("counts whole days back", () => {
    expect(daysLate(at("2026-09-20T10:00:00"), edges)).toBe(2);
    expect(daysLate(at("2026-09-19T10:00:00"), edges)).toBe(3);
    expect(daysLate(at("2026-09-15T10:00:00"), edges)).toBe(7);
  });
});

describe("escalation", () => {
  it("escalates only at the threshold, not before", () => {
    expect(isEscalated(at("2026-09-21T10:00:00"), edges)).toBe(false); // 1 day
    expect(isEscalated(at("2026-09-20T10:00:00"), edges)).toBe(false); // 2 days
    expect(isEscalated(at("2026-09-19T10:00:00"), edges)).toBe(true); // 3 days
    expect(isEscalated(at("2026-09-01T10:00:00"), edges)).toBe(true);
  });

  it("agrees with the day count at the boundary", () => {
    const threshold = at("2026-09-19T10:00:00");
    expect(daysLate(threshold, edges)).toBe(ESCALATION_DAYS);
    expect(isEscalated(threshold, edges)).toBe(true);
  });

  it("never escalates something that is not overdue", () => {
    expect(isEscalated(at("2026-09-22T09:00:00"), edges)).toBe(false);
    expect(isEscalated(at("2026-12-01T09:00:00"), edges)).toBe(false);
  });
});
