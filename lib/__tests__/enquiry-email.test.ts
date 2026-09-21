import { describe, it, expect } from "vitest";
import { enquiryReceivedEmail } from "@/lib/email/templates";

/**
 * The enquiry acknowledgement is the one template that puts a customer's own
 * typing into the markup, so it is the one that has to escape.
 */
describe("enquiry acknowledgement", () => {
  it("escapes what the customer wrote", () => {
    const html = enquiryReceivedEmail({
      name: "Anita",
      message: 'Need a <script>alert(1)</script> quote & a "sea view" room',
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp;");
    expect(html).toContain("&quot;");
  });

  it("includes only the details that were given", () => {
    const bare = enquiryReceivedEmail({ name: "Anita" });
    expect(bare).toContain("Anita");
    expect(bare).not.toContain("Destination");
    expect(bare).not.toContain("Travellers");

    const full = enquiryReceivedEmail({
      name: "Anita",
      destination: "Bali",
      travellers: 2,
      businessHours: "Mon–Sat",
    });
    expect(full).toContain("Bali");
    expect(full).toContain("Travellers");
    expect(full).toContain("Mon–Sat");
  });

  it("promises nothing that has not been agreed", () => {
    // An acknowledgement is not a confirmation: no prices, no booking talk.
    const html = enquiryReceivedEmail({ name: "Anita", destination: "Bali" });
    expect(html).not.toMatch(/\bbooked\b|\bconfirmed\b|\bpaid\b|\binvoice\b/i);
  });
});
