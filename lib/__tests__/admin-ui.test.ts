import { describe, it, expect } from "vitest";
import {
  NAV_GROUPS,
  navigationFor,
  isNavItemActive,
  breadcrumbsFor,
  labelForSegment,
} from "@/lib/admin-nav";
import {
  leadStatusTone,
  bookingStatusTone,
  paymentStatusTone,
  priorityTone,
  humanStatus,
} from "@/lib/admin-status";
import { SECTION_PERMISSIONS, roleLabel } from "@/lib/permissions";

/* ───────────────────────── navigation ───────────────────────── */

describe("navigation model", () => {
  it("only names permission sections that actually exist", () => {
    // A typo here would silently hide an item from everyone but an admin,
    // because canAccessSection closes unknown sections by default.
    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        expect(SECTION_PERMISSIONS, `${item.label} → ${item.section}`).toHaveProperty(item.section);
      }
    }
  });

  it("points every item at an /admin route", () => {
    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        expect(item.href.startsWith("/admin/")).toBe(true);
      }
    }
  });

  it("has no duplicate destinations", () => {
    const hrefs = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

describe("navigationFor", () => {
  it("gives a super admin everything", () => {
    const groups = navigationFor("SUPER_ADMIN");
    const items = groups.flatMap((group) => group.items);
    expect(items.length).toBe(NAV_GROUPS.flatMap((group) => group.items).length);
  });

  it("drops groups a role cannot open, rather than showing them empty", () => {
    const groups = navigationFor("SALES_EXECUTIVE");
    expect(groups.every((group) => group.items.length > 0)).toBe(true);
    // A sales executive has no business in Users & roles.
    const sections = groups.flatMap((group) => group.items.map((item) => item.section));
    expect(sections).not.toContain("users");
    expect(sections).not.toContain("settings");
  });

  it("gives an unknown or missing role nothing it should not have", () => {
    const sections = navigationFor(undefined).flatMap((group) =>
      group.items.map((item) => item.section),
    );
    expect(sections).not.toContain("users");
    expect(sections).not.toContain("settings");
  });

  it("gives a content manager the content group but not the CRM", () => {
    const sections = navigationFor("CONTENT_MANAGER").flatMap((group) =>
      group.items.map((item) => item.section),
    );
    expect(sections).toContain("pages");
    expect(sections).toContain("blogs");
    expect(sections).not.toContain("leads");
  });
});

describe("isNavItemActive", () => {
  const leads = { href: "/admin/leads", label: "Leads", icon: null as never, section: "leads" };
  const followUps = {
    href: "/admin/leads?due=today",
    label: "Follow-ups",
    icon: null as never,
    section: "leads",
    exact: true,
  };

  it("matches a section and its child routes", () => {
    expect(isNavItemActive(leads, "/admin/leads", "")).toBe(true);
    expect(isNavItemActive(leads, "/admin/leads/abc123", "")).toBe(true);
    expect(isNavItemActive(leads, "/admin/bookings", "")).toBe(false);
  });

  it("only lights a filtered view on an exact query match", () => {
    expect(isNavItemActive(followUps, "/admin/leads", "due=today")).toBe(true);
    expect(isNavItemActive(followUps, "/admin/leads", "")).toBe(false);
    expect(isNavItemActive(followUps, "/admin/leads", "due=overdue")).toBe(false);
  });

  it("does not light the parent when a filtered view is open", () => {
    // Otherwise Leads and Follow-ups would both read as current.
    const exactParent = { ...leads, exact: true };
    expect(isNavItemActive(exactParent, "/admin/leads", "due=today")).toBe(false);
  });

  it("does not match a sibling whose path merely shares a prefix", () => {
    const pages = { href: "/admin/pages", label: "Pages", icon: null as never, section: "pages" };
    expect(isNavItemActive(pages, "/admin/pages-archive", "")).toBe(false);
  });
});

describe("breadcrumbsFor", () => {
  it("drops the /admin root and leaves the last crumb unlinked", () => {
    const crumbs = breadcrumbsFor("/admin/leads");
    expect(crumbs).toEqual([{ label: "Leads", href: undefined }]);
  });

  it("links every crumb but the last", () => {
    const crumbs = breadcrumbsFor("/admin/pages/templates");
    expect(crumbs.map((crumb) => crumb.label)).toEqual(["Pages", "Templates"]);
    expect(crumbs[0]!.href).toBe("/admin/pages");
    expect(crumbs[1]!.href).toBeUndefined();
  });

  it("skips record ids, which have no readable label", () => {
    const crumbs = breadcrumbsFor("/admin/packages/clx9a8b7c6d5e4f3g2h1i0/edit");
    expect(crumbs.map((crumb) => crumb.label)).toEqual(["Packages", "Edit"]);
  });

  it("falls back to Dashboard at the admin root", () => {
    expect(breadcrumbsFor("/admin")).toEqual([{ label: "Dashboard" }]);
  });

  it("humanises a segment it has no label for", () => {
    expect(labelForSegment("some-new-section")).toBe("Some new section");
  });
});

/* ───────────────────────── status tones ───────────────────────── */

describe("status tones", () => {
  it("reads the same status differently where it means different things", () => {
    // A PENDING booking is merely new; a PENDING payment is money owed.
    expect(bookingStatusTone("PENDING")).toBe("slate");
    expect(paymentStatusTone("PENDING")).toBe("amber");
  });

  it("marks won green and lost red", () => {
    expect(leadStatusTone("CONVERTED")).toBe("green");
    expect(leadStatusTone("LOST")).toBe("red");
  });

  it("escalates priority colour", () => {
    expect(priorityTone("URGENT")).toBe("red");
    expect(priorityTone("HIGH")).toBe("amber");
    expect(priorityTone("NORMAL")).toBe("slate");
  });

  it("falls back to neutral for a status it does not know", () => {
    expect(leadStatusTone("SOMETHING_NEW")).toBe("slate");
    expect(bookingStatusTone("")).toBe("slate");
    expect(paymentStatusTone("WHATEVER")).toBe("slate");
  });
});

describe("humanStatus", () => {
  it("turns an UPPER_SNAKE status into a sentence", () => {
    expect(humanStatus("PAYMENT_PENDING")).toBe("Payment pending");
    expect(humanStatus("PAID")).toBe("Paid");
    expect(humanStatus("PARTIALLY_REFUNDED")).toBe("Partially refunded");
  });

  it("handles an empty value without throwing", () => {
    expect(humanStatus("")).toBe("");
  });
});

describe("roleLabel", () => {
  it("uses the configured label", () => {
    expect(roleLabel("SUPER_ADMIN")).toBe("Super Admin");
    expect(roleLabel("SALES_EXECUTIVE")).toBe("Sales Executive");
  });

  it("degrades gracefully for an unknown or missing role", () => {
    expect(roleLabel("SOME_NEW_ROLE")).toBe("some new role");
    expect(roleLabel(null)).toBe("No role");
  });
});
