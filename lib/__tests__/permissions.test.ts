import { describe, it, expect } from "vitest";
import {
  ROLES,
  hasPermission,
  canAccessSection,
  canAccessPath,
  canAssignLeads,
  isLeadOwnerOnly,
  landingPathFor,
  publishBlocked,
  permissionsFor,
  type Role,
} from "@/lib/permissions";

/**
 * These assert the behaviour the security model depends on, not the shape of
 * the matrix: what each role can and cannot reach.
 */

describe("role matrix", () => {
  it("gives the owner roles everything", () => {
    for (const role of ["SUPER_ADMIN", "ADMIN"] satisfies Role[]) {
      expect(hasPermission(role, "users:manage")).toBe(true);
      expect(hasPermission(role, "settings:manage")).toBe(true);
      expect(hasPermission(role, "export:data")).toBe(true);
      expect(hasPermission(role, "packages:delete")).toBe(true);
    }
  });

  it("grants nothing to an unknown or missing role", () => {
    expect(permissionsFor(undefined)).toEqual([]);
    expect(permissionsFor("")).toEqual([]);
    expect(permissionsFor("ROOT")).toEqual([]);
    expect(hasPermission("ROOT", "users:manage")).toBe(false);
    // An attacker-supplied role string must not open anything.
    expect(hasPermission("SUPER_ADMIN ", "users:manage")).toBe(false);
  });

  it("keeps user and settings management away from every non-owner role", () => {
    const nonOwners = ROLES.filter((role) => role !== "SUPER_ADMIN" && role !== "ADMIN");
    for (const role of nonOwners) {
      expect(hasPermission(role, "users:manage")).toBe(false);
      expect(hasPermission(role, "settings:manage")).toBe(false);
      expect(hasPermission(role, "export:data")).toBe(false);
    }
  });

  it("stops content roles reaching the sales desk and vice versa", () => {
    expect(hasPermission("CONTENT_MANAGER", "packages:update")).toBe(true);
    expect(hasPermission("CONTENT_MANAGER", "leads:view")).toBe(false);
    expect(hasPermission("CONTENT_MANAGER", "bookings:update")).toBe(false);

    expect(hasPermission("BOOKING_MANAGER", "leads:view")).toBe(true);
    expect(hasPermission("BOOKING_MANAGER", "packages:update")).toBe(false);
    expect(hasPermission("BOOKING_MANAGER", "blogs:delete")).toBe(false);
  });

  it("lets an editor edit but never create, delete or publish", () => {
    expect(hasPermission("EDITOR", "packages:update")).toBe(true);
    expect(hasPermission("EDITOR", "blogs:update")).toBe(true);
    expect(hasPermission("EDITOR", "packages:create")).toBe(false);
    expect(hasPermission("EDITOR", "packages:delete")).toBe(false);
    expect(hasPermission("EDITOR", "packages:publish")).toBe(false);
    expect(hasPermission("EDITOR", "blogs:publish")).toBe(false);
  });

  it("keeps a viewer read-only", () => {
    expect(hasPermission("VIEWER", "leads:view")).toBe(true);
    expect(hasPermission("VIEWER", "bookings:view")).toBe(true);
    for (const permission of [
      "leads:update",
      "leads:delete",
      "bookings:update",
      "packages:update",
      "media:upload",
      "documents:create",
    ] as const) {
      expect(hasPermission("VIEWER", permission)).toBe(false);
    }
  });

  it("restricts agents and sales executives to their own pipeline", () => {
    expect(isLeadOwnerOnly("AGENT")).toBe(true);
    expect(isLeadOwnerOnly("SALES_EXECUTIVE")).toBe(true);
    expect(isLeadOwnerOnly("MANAGER")).toBe(false);
    expect(isLeadOwnerOnly(undefined)).toBe(false);
  });

  it("only lets managers reassign leads", () => {
    expect(canAssignLeads("SUPER_ADMIN")).toBe(true);
    expect(canAssignLeads("MANAGER")).toBe(true);
    expect(canAssignLeads("BOOKING_MANAGER")).toBe(true);
    expect(canAssignLeads("SALES_EXECUTIVE")).toBe(false);
    expect(canAssignLeads("AGENT")).toBe(false);
    expect(canAssignLeads(undefined)).toBe(false);
  });
});

describe("section access", () => {
  it("closes every admin section to a signed-out visitor", () => {
    for (const section of ["dashboard", "leads", "settings", "users", "activity-log"]) {
      expect(canAccessSection(undefined, section)).toBe(false);
    }
  });

  it("closes an unknown section to everyone but the owner roles", () => {
    // A new admin page is invisible until it is added to the matrix.
    expect(canAccessSection("ADMIN", "brand-new-section")).toBe(true);
    expect(canAccessSection("MANAGER", "brand-new-section")).toBe(false);
    expect(canAccessSection("VIEWER", "brand-new-section")).toBe(false);
  });

  it("checks the section from a full pathname", () => {
    expect(canAccessPath("CONTENT_MANAGER", "/admin/packages/abc/edit")).toBe(true);
    expect(canAccessPath("CONTENT_MANAGER", "/admin/settings/anything")).toBe(false);
    expect(canAccessPath("SALES_EXECUTIVE", "/admin/users")).toBe(false);
    // The login page is always reachable.
    expect(canAccessPath(undefined, "/admin/login")).toBe(true);
    // Non-admin paths are not this function's business.
    expect(canAccessPath(undefined, "/packages/bali")).toBe(true);
  });

  it("sends each role somewhere it is allowed to land", () => {
    expect(landingPathFor("ADMIN")).toBe("/admin/dashboard");
    expect(landingPathFor("SALES_EXECUTIVE")).toBe("/admin/leads");
    expect(landingPathFor("AGENT")).toBe("/admin/leads");
    expect(landingPathFor(undefined)).toBe("/admin/login");
  });
});

describe("publish guard", () => {
  it("allows an edit that does not change publication state", () => {
    expect(publishBlocked("EDITOR", "packages:publish", false)).toBeNull();
  });

  it("blocks an editor from publishing or unpublishing", () => {
    expect(publishBlocked("EDITOR", "packages:publish", true)).toBeTypeOf("string");
  });

  it("lets a content manager publish", () => {
    expect(publishBlocked("CONTENT_MANAGER", "packages:publish", true)).toBeNull();
  });
});

/**
 * The finance export is every customer's name, contact details and what they
 * paid, in one file. It is deliberately narrower than the roles that can read
 * an invoice on screen, so this pins who holds it.
 */
describe("documents:export", () => {
  it("is held only by the two owner roles", () => {
    expect(hasPermission("SUPER_ADMIN", "documents:export")).toBe(true);
    expect(hasPermission("ADMIN", "documents:export")).toBe(true);

    for (const role of [
      "MANAGER",
      "BOOKING_MANAGER",
      "CONTENT_MANAGER",
      "SALES",
      "SALES_EXECUTIVE",
      "EDITOR",
      "AGENT",
      "VIEWER",
    ]) {
      expect(hasPermission(role, "documents:export"), role).toBe(false);
    }
  });

  it("does not follow from being able to read documents", () => {
    // Several roles can open an invoice; none of them may bulk-download the book.
    for (const role of ["MANAGER", "BOOKING_MANAGER"]) {
      expect(hasPermission(role, "documents:view"), role).toBe(true);
      expect(hasPermission(role, "documents:export"), role).toBe(false);
    }
  });

  it("is separate from the general data export", () => {
    // Granting one must not imply the other in either direction.
    expect(hasPermission("AGENT", "documents:export")).toBe(false);
  });

  it("nobody without a role gets it", () => {
    expect(hasPermission(undefined, "documents:export")).toBe(false);
    expect(hasPermission(null, "documents:export")).toBe(false);
    expect(hasPermission("NOT_A_ROLE", "documents:export")).toBe(false);
  });
});
