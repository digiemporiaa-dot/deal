import { describe, it, expect } from "vitest";
import {
  DOC_LABEL,
  DOC_STATUSES,
  STATUS_TONE,
  docLabel,
  docRoute,
} from "@/lib/documents-shared";

describe("document vocabulary", () => {
  it("routes each kind to its own section", () => {
    expect(DOC_LABEL.QUOTATION.route).toBe("quotations");
    expect(DOC_LABEL.INVOICE.route).toBe("invoices");
  });

  it("falls back rather than indexing blindly on an unknown kind", () => {
    // `kind` is a plain string in the database, so these are reachable.
    expect(docRoute("SOMETHING_ELSE")).toBe("quotations");
    expect(docLabel("SOMETHING_ELSE")).toBe("Document");
    expect(docRoute("")).toBe("quotations");
  });

  it("knows ACCEPTED for quotations and PAID for invoices", () => {
    // The conversion rule depends on ACCEPTED being a real quotation status.
    expect(DOC_STATUSES.QUOTATION).toContain("ACCEPTED");
    expect(DOC_STATUSES.INVOICE).toContain("PAID");
    // An invoice is never "accepted" and a quotation is never "paid".
    expect(DOC_STATUSES.INVOICE).not.toContain("ACCEPTED");
    expect(DOC_STATUSES.QUOTATION).not.toContain("PAID");
  });

  it("gives every status of both kinds a tone", () => {
    for (const kind of ["QUOTATION", "INVOICE"] as const) {
      for (const status of DOC_STATUSES[kind]) {
        expect(STATUS_TONE[status], `${kind} ${status}`).toBeDefined();
      }
    }
  });
});
