import "server-only";
import { prisma } from "@/lib/db";
import { normalizeEmail, normalizePhone, leadStatusLabel, isClosedStatus } from "@/lib/crm";
import type { Prisma } from "@prisma/client";

/**
 * Duplicate detection.
 *
 * A travel desk gets the same enquiry twice constantly — the customer fills
 * the form, then messages on WhatsApp, then an agent types it in from a phone
 * call. Three rows, one trip, and three people chasing it.
 *
 * Matching is on the *normalised* phone key or a case-insensitive email, never
 * on the raw strings, because "+91 98765 43210" and "9876543210" are the same
 * person. Nothing here merges or deletes anything: it reports what it found
 * and lets a human decide. Automatic merging of customer records is how a CRM
 * loses data it cannot get back.
 */

export type DuplicateLead = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  destination: string | null;
  status: string;
  statusLabel: string;
  createdAt: Date;
  assignedToId: string | null;
  assignedToName: string | null;
  /** Which field matched — shown so the user can judge the match. */
  matchedOn: ("phone" | "email")[];
};

export type DuplicateCheck = {
  /** Anything at all matched. */
  isDuplicate: boolean;
  /** An *open* duplicate — someone is probably already working this. */
  hasOpenDuplicate: boolean;
  leads: DuplicateLead[];
};

const EMPTY: DuplicateCheck = { isDuplicate: false, hasOpenDuplicate: false, leads: [] };

const DUPLICATE_SELECT = {
  id: true,
  name: true,
  phone: true,
  phoneKey: true,
  email: true,
  destination: true,
  status: true,
  createdAt: true,
  convertedAt: true,
  assignedToId: true,
  assignedTo: { select: { name: true } },
} satisfies Prisma.LeadSelect;

/**
 * Leads that look like the same person as the contact details given.
 *
 * Deliberately *not* scoped to the caller's own pipeline: a sales executive
 * needs to know a lead is already being worked by a colleague, otherwise both
 * of them call the customer. Only the name, status and owner come back — not
 * the notes, budget or message — so this reveals that a duplicate exists
 * without handing over another agent's working file.
 */
export async function findDuplicateLeads(input: {
  phone?: string | null;
  email?: string | null;
  /** The lead being edited, so it does not match itself. */
  excludeLeadId?: string | null;
  limit?: number;
}): Promise<DuplicateCheck> {
  const phoneKey = normalizePhone(input.phone);
  const email = normalizeEmail(input.email);
  if (!phoneKey && !email) return EMPTY;

  const or: Prisma.LeadWhereInput[] = [];
  if (phoneKey) or.push({ phoneKey });
  if (email) or.push({ email: { equals: email, mode: "insensitive" } });

  const rows = await prisma.lead.findMany({
    where: {
      OR: or,
      ...(input.excludeLeadId ? { NOT: { id: input.excludeLeadId } } : {}),
    },
    select: DUPLICATE_SELECT,
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(input.limit ?? 5, 1), 20),
  });

  const leads: DuplicateLead[] = rows.map((row) => {
    const matchedOn: ("phone" | "email")[] = [];
    if (phoneKey && row.phoneKey === phoneKey) matchedOn.push("phone");
    if (email && normalizeEmail(row.email) === email) matchedOn.push("email");

    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      email: row.email,
      destination: row.destination,
      status: row.status,
      statusLabel: leadStatusLabel(row.status),
      createdAt: row.createdAt,
      assignedToId: row.assignedToId,
      assignedToName: row.assignedTo?.name ?? null,
      matchedOn,
    };
  });

  return {
    isDuplicate: leads.length > 0,
    hasOpenDuplicate: leads.some((lead) => !isClosedStatus(lead.status)),
    leads,
  };
}

/**
 * An existing customer with the same phone or email.
 *
 * This is what makes conversion safe to run twice: a lead from a repeat
 * customer attaches to the record that is already there instead of creating a
 * second one, so their booking history stays in one place.
 */
export async function findMatchingCustomer(input: {
  phone?: string | null;
  email?: string | null;
}) {
  const phoneKey = normalizePhone(input.phone);
  const email = normalizeEmail(input.email);
  if (!phoneKey && !email) return null;

  // Email is checked first: two people can share a landline, but an email
  // address is one person.
  if (email) {
    const byEmail = await prisma.customer.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      orderBy: { createdAt: "asc" },
    });
    if (byEmail) return byEmail;
  }

  if (phoneKey) {
    const byPhone = await prisma.customer.findFirst({
      where: { phoneKey },
      orderBy: { createdAt: "asc" },
    });
    if (byPhone) return byPhone;
  }

  return null;
}
