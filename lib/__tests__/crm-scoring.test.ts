import { describe, it, expect } from "vitest";
import {
  LEAD_STATUSES,
  CLOSED_STATUSES,
  OPEN_STATUSES,
  WON_STATUS,
  isClosedStatus,
  leadStatusLabel,
  leadStatusOrder,
  normalizePhone,
  normalizeEmail,
  samePhone,
  parseBudget,
  parseTags,
  serializeTags,
  scoreLead,
  scoreBandFor,
  HOT_THRESHOLD,
  WARM_THRESHOLD,
} from "@/lib/crm";

/**
 * The scoring and matching rules the CRM upgrade added.
 *
 * Every test here covers something that would silently produce wrong numbers
 * rather than an exception — a duplicate that is not spotted, a budget that
 * reads as ten times what the customer said, a closed lead still sitting at
 * the top of a queue.
 */

describe("pipeline vocabulary", () => {
  it("keeps the two legacy stored values so existing rows stay valid", () => {
    expect(LEAD_STATUSES as readonly string[]).toContain("CONVERTED");
    expect(LEAD_STATUSES as readonly string[]).toContain("PROPOSAL_SENT");
    expect(leadStatusLabel("CONVERTED")).toBe("Won");
    expect(leadStatusLabel("PROPOSAL_SENT")).toBe("Proposal");
    expect(WON_STATUS).toBe("CONVERTED");
  });

  it("adds the two new stages without disturbing the old ones", () => {
    expect(LEAD_STATUSES as readonly string[]).toContain("NEGOTIATION");
    expect(LEAD_STATUSES as readonly string[]).toContain("JUNK");
    for (const status of ["NEW", "CONTACTED", "QUALIFIED", "FOLLOW_UP", "CONVERTED", "LOST"]) {
      expect(LEAD_STATUSES as readonly string[]).toContain(status);
    }
  });

  it("treats junk as closed, so nobody is asked to chase it", () => {
    expect(isClosedStatus("JUNK")).toBe(true);
    expect(isClosedStatus("LOST")).toBe(true);
    expect(isClosedStatus("CONVERTED")).toBe(true);
    expect(isClosedStatus("NEGOTIATION")).toBe(false);
  });

  it("splits every status into exactly one of open or closed", () => {
    expect(OPEN_STATUSES.length + CLOSED_STATUSES.length).toBe(LEAD_STATUSES.length);
    for (const status of OPEN_STATUSES) expect(isClosedStatus(status)).toBe(false);
  });

  it("orders negotiation after proposal", () => {
    expect(leadStatusOrder("NEGOTIATION")).toBeGreaterThan(leadStatusOrder("PROPOSAL_SENT"));
    expect(leadStatusOrder("PROPOSAL_SENT")).toBeGreaterThan(leadStatusOrder("QUALIFIED"));
  });
});

describe("phone matching", () => {
  it("keys the same number typed five different ways to one value", () => {
    const forms = [
      "+91 98765 43210",
      "+919876543210",
      "098765-43210",
      "(98765) 43210",
      "9876543210",
    ];
    const keys = new Set(forms.map((form) => normalizePhone(form)));
    expect(keys.size).toBe(1);
    expect([...keys][0]).toBe("9876543210");
  });

  it("does not invent a key from nothing", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone("n/a")).toBeNull();
  });

  it("keeps different numbers apart", () => {
    expect(samePhone("+91 98765 43210", "9876543210")).toBe(true);
    expect(samePhone("9876543210", "9876543211")).toBe(false);
    // Two blanks are not the same person.
    expect(samePhone(null, null)).toBe(false);
    expect(samePhone("", "")).toBe(false);
  });

  it("lower-cases email for matching without inventing one", () => {
    expect(normalizeEmail("  Asha@Example.COM ")).toBe("asha@example.com");
    expect(normalizeEmail("")).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
  });
});

describe("budget parsing", () => {
  it("reads the shapes the form and the agents actually produce", () => {
    expect(parseBudget("50000")).toBe(50_000);
    expect(parseBudget("₹50,000")).toBe(50_000);
    expect(parseBudget("50k")).toBe(50_000);
    expect(parseBudget("1.5 lakh")).toBe(150_000);
    expect(parseBudget("2L")).toBe(200_000);
    expect(parseBudget("1 crore")).toBe(10_000_000);
  });

  it("takes the lower bound of a range, never the flattering end", () => {
    expect(parseBudget("₹50,000 - ₹75,000")).toBe(50_000);
  });

  it("applies a unit written once at the end of a range to both numbers", () => {
    expect(parseBudget("1-2 lakh")).toBe(100_000);
    expect(parseBudget("50-75k")).toBe(50_000);
    expect(parseBudget("2 to 3 lakh")).toBe(200_000);
  });

  it("does not turn a figure that is already rupees into lakhs", () => {
    // "50000" is a rupee amount on its own; only a small bare number is a
    // multiplier waiting for the unit at the end of the range.
    expect(parseBudget("50000 or 2 lakh")).toBe(50_000);
  });

  it("returns null rather than a zero for text with no figure in it", () => {
    expect(parseBudget("Not sure")).toBeNull();
    expect(parseBudget("")).toBeNull();
    expect(parseBudget(null)).toBeNull();
  });
});

describe("tags", () => {
  it("survives a corrupt value instead of throwing", () => {
    expect(parseTags("not json")).toEqual([]);
    expect(parseTags('{"a":1}')).toEqual([]);
    expect(parseTags(null)).toEqual([]);
    expect(parseTags("[]")).toEqual([]);
  });

  it("de-duplicates case-insensitively and drops blanks", () => {
    expect(JSON.parse(serializeTags(["Honeymoon", "honeymoon", "  ", "Goa"]))).toEqual([
      "Honeymoon",
      "Goa",
    ]);
  });

  it("round-trips", () => {
    expect(parseTags(serializeTags(["Family", "Kashmir"]))).toEqual(["Family", "Kashmir"]);
  });

  it("caps the list so one lead cannot carry a hundred tags", () => {
    const many = Array.from({ length: 50 }, (_, i) => `tag-${i}`);
    expect(parseTags(serializeTags(many))).toHaveLength(20);
  });
});

describe("lead scoring", () => {
  const now = new Date("2026-09-21T00:00:00.000Z");
  const soon = new Date("2026-10-05T00:00:00.000Z"); // 14 days out
  const distant = new Date("2027-09-21T00:00:00.000Z"); // a year out

  it("is deterministic — the same lead always scores the same", () => {
    const lead = {
      email: "asha@example.com",
      phone: "9876543210",
      budget: "1.5 lakh",
      travelDate: soon,
      now,
    };
    expect(scoreLead(lead).score).toBe(scoreLead(lead).score);
  });

  it("scores a near-term, well-qualified enquiry hot", () => {
    const result = scoreLead({
      email: "asha@example.com",
      phone: "9876543210",
      whatsapp: "9876543210",
      destination: "Kashmir",
      packageId: "pkg_1",
      budget: "2 lakh",
      travelDate: soon,
      adults: 4,
      children: 2,
      source: "REFERRAL",
      status: "QUALIFIED",
      activityCount: 3,
      lastActivityAt: now,
      now,
    });
    expect(result.band).toBe("HOT");
    expect(result.score).toBeGreaterThanOrEqual(HOT_THRESHOLD);
  });

  it("scores a bare phone number with no trip detail cold", () => {
    const result = scoreLead({ phone: "9876543210", status: "NEW", now });
    expect(result.band).toBe("COLD");
    expect(result.score).toBeLessThan(WARM_THRESHOLD);
  });

  it("ranks a trip next month above the same trip next year", () => {
    const base = { phone: "9876543210", budget: "1 lakh", email: "a@b.com", now };
    expect(scoreLead({ ...base, travelDate: soon }).score).toBeGreaterThan(
      scoreLead({ ...base, travelDate: distant }).score,
    );
  });

  it("does not treat a travel date that has already passed as urgent", () => {
    const base = { phone: "9876543210", email: "a@b.com", now };
    const past = scoreLead({ ...base, travelDate: new Date("2026-01-01T00:00:00.000Z") });
    const upcoming = scoreLead({ ...base, travelDate: soon });
    expect(past.score).toBeLessThan(upcoming.score);
  });

  it("ranks a bigger budget above a smaller one, all else equal", () => {
    const base = { phone: "9876543210", travelDate: soon, now };
    expect(scoreLead({ ...base, budget: "2 lakh" }).score).toBeGreaterThan(
      scoreLead({ ...base, budget: "20000" }).score,
    );
  });

  it("zeroes a lost or junk lead however good its attributes are", () => {
    const strong = {
      email: "asha@example.com",
      phone: "9876543210",
      whatsapp: "9876543210",
      packageId: "pkg_1",
      budget: "5 lakh",
      travelDate: soon,
      adults: 6,
      source: "REFERRAL",
      activityCount: 5,
      lastActivityAt: now,
      now,
    };
    expect(scoreLead({ ...strong, status: "LOST" }).score).toBe(0);
    expect(scoreLead({ ...strong, status: "JUNK" }).score).toBe(0);
    // A won lead keeps its score — it is history worth reporting on.
    expect(scoreLead({ ...strong, status: "CONVERTED" }).score).toBeGreaterThan(0);
  });

  it("never leaves the 0-100 range", () => {
    const maxed = scoreLead({
      email: "a@b.com",
      phone: "9876543210",
      whatsapp: "9876543210",
      destination: "Kashmir",
      packageId: "pkg_1",
      budget: "10 crore",
      travelDate: soon,
      adults: 40,
      children: 10,
      source: "REFERRAL",
      activityCount: 500,
      lastActivityAt: now,
      now,
    });
    expect(maxed.score).toBeLessThanOrEqual(100);
    expect(maxed.score).toBeGreaterThanOrEqual(0);
    expect(scoreLead({ now }).score).toBeGreaterThanOrEqual(0);
  });

  it("explains itself — every point is attributable to a named reason", () => {
    const result = scoreLead({
      email: "a@b.com",
      phone: "9876543210",
      budget: "1 lakh",
      travelDate: soon,
      now,
    });
    const summed = result.reasons.reduce((total, reason) => total + reason.points, 0);
    expect(summed).toBe(result.score);
    expect(result.reasons.every((reason) => reason.label.length > 0)).toBe(true);
  });

  it("agrees with scoreBandFor at the thresholds", () => {
    expect(scoreBandFor(HOT_THRESHOLD)).toBe("HOT");
    expect(scoreBandFor(HOT_THRESHOLD - 1)).toBe("WARM");
    expect(scoreBandFor(WARM_THRESHOLD)).toBe("WARM");
    expect(scoreBandFor(WARM_THRESHOLD - 1)).toBe("COLD");
    expect(scoreBandFor(0)).toBe("COLD");
  });
});
