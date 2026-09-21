import "server-only";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { normalizeEmail, normalizePhone, WON_STATUS, isClosedStatus } from "@/lib/crm";
import { findMatchingCustomer } from "@/lib/services/lead-dedupe";
import { closeFollowUpsForLead } from "@/lib/services/follow-up";
import type { AdminActor } from "@/lib/guard";

/**
 * Lead → customer conversion.
 *
 * This was the hole in the middle of the CRM: a lead could be marked Won, but
 * nothing turned it into a customer, so the pipeline and the booking system
 * never met. A won lead was a status and nothing else.
 *
 * Two rules govern the whole module.
 *
 * **Reuse, never duplicate.** A returning customer must land on the record
 * that already holds their bookings. Matching is on email *or* normalised
 * phone, so "+91 98765 43210" finds the row stored as "9876543210".
 *
 * **Convert once.** `Lead.customerId` is the settled flag. Every write is
 * guarded on it being null, so a double-click, a retried request or two open
 * tabs produce one customer and one timeline entry — the second call returns
 * the same customer and says plainly that it changed nothing.
 *
 * Nothing here deletes or overwrites a customer's existing details. A blank
 * field on the customer may be filled in from the lead; a field that already
 * has a value is left exactly as it is, because the customer record is the one
 * they confirmed at booking and the lead is what someone typed into a form.
 */

export type ConversionResult =
  | {
      ok: true;
      customerId: string;
      customerName: string;
      /** False when the lead had already been converted. */
      changed: boolean;
      /** True when an existing customer was reused rather than created. */
      matchedExisting: boolean;
    }
  | { ok: false; error: string };

export async function convertLeadToCustomer(input: {
  leadId: string;
  actor: AdminActor;
  /** Optional note recorded on the timeline and the status history. */
  reason?: string | null;
}): Promise<ConversionResult> {
  const lead = await prisma.lead.findUnique({
    where: { id: input.leadId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      whatsapp: true,
      country: true,
      status: true,
      customerId: true,
    },
  });
  if (!lead) return { ok: false, error: "Lead not found" };

  // Already converted — report the customer it became and change nothing.
  if (lead.customerId) {
    const existing = await prisma.customer.findUnique({
      where: { id: lead.customerId },
      select: { id: true, name: true },
    });
    if (existing) {
      return {
        ok: true,
        customerId: existing.id,
        customerName: existing.name,
        changed: false,
        matchedExisting: true,
      };
    }
    // The customer was deleted underneath us; fall through and rebuild it.
  }

  const email = normalizeEmail(lead.email);
  const phoneKey = normalizePhone(lead.phone);

  const match = await findMatchingCustomer({ email, phone: lead.phone });

  try {
    const result = await prisma.$transaction(async (tx) => {
      let customer: { id: string; name: string };

      if (match) {
        // Fill in only what is missing. Never overwrite a confirmed detail.
        await tx.customer.update({
          where: { id: match.id },
          data: {
            whatsapp: match.whatsapp ?? lead.whatsapp ?? null,
            country: match.country ?? lead.country ?? null,
            phoneKey: match.phoneKey ?? phoneKey,
          },
        });
        customer = { id: match.id, name: match.name };
      } else {
        // Customer.email is a required column and part of the (email, phone)
        // unique key. A lead without one gets an empty string rather than a
        // fabricated address — the pair stays unique on the phone alone, and
        // "we don't have their email" stays visibly true.
        const created = await tx.customer.create({
          data: {
            name: lead.name,
            email: email ?? "",
            phone: lead.phone,
            phoneKey,
            whatsapp: lead.whatsapp,
            country: lead.country,
          },
          select: { id: true, name: true },
        });
        customer = created;
      }

      const now = new Date();

      // The guard is the whole idempotency story: only the first caller to
      // find customerId still null gets to claim the conversion.
      const claimed = await tx.lead.updateMany({
        where: { id: lead.id, customerId: null },
        data: {
          customerId: customer.id,
          convertedAt: now,
          status: WON_STATUS,
          lastActivityAt: now,
        },
      });

      if (claimed.count === 0) {
        return { customer, changed: false };
      }

      await tx.leadStatusChange.create({
        data: {
          leadId: lead.id,
          fromStatus: lead.status,
          toStatus: WON_STATUS,
          changedById: input.actor.id,
          reason: input.reason?.trim().slice(0, 500) || "Converted to customer",
        },
      });

      await tx.leadNote.create({
        data: {
          leadId: lead.id,
          authorId: input.actor.id,
          type: "CONVERSION",
          body: match
            ? `Converted — linked to existing customer ${customer.name}`
            : `Converted — created customer ${customer.name}`,
        },
      });

      await closeFollowUpsForLead(lead.id, "Lead converted to customer", tx);

      return { customer, changed: true };
    });

    logger.info("lead.converted", {
      leadId: lead.id,
      customerId: result.customer.id,
      matchedExisting: Boolean(match),
      changed: result.changed,
    });

    return {
      ok: true,
      customerId: result.customer.id,
      customerName: result.customer.name,
      changed: result.changed,
      matchedExisting: Boolean(match),
    };
  } catch (error) {
    logger.error("lead.convert_failed", { leadId: lead.id, error });
    return { ok: false, error: "Could not convert this lead. Nothing was changed." };
  }
}

/**
 * Record a pipeline move and its side effects.
 *
 * Every status change goes through here so the history table can never
 * disagree with the lead: they are written in one transaction. Moving to a
 * closed status also stands the follow-up queue down, and moving to Won hands
 * off to `convertLeadToCustomer` rather than half-doing it here.
 */
export async function recordStatusChange(input: {
  leadId: string;
  fromStatus: string;
  toStatus: string;
  actor: AdminActor;
  reason?: string | null;
}) {
  const reason = input.reason?.trim().slice(0, 500) || null;

  await prisma.$transaction(async (tx) => {
    await tx.lead.update({
      where: { id: input.leadId },
      data: {
        status: input.toStatus,
        lastActivityAt: new Date(),
        ...(input.toStatus === "LOST" && reason ? { lostReason: reason } : {}),
      },
    });

    await tx.leadStatusChange.create({
      data: {
        leadId: input.leadId,
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        changedById: input.actor.id,
        reason,
      },
    });

    if (isClosedStatus(input.toStatus)) {
      await closeFollowUpsForLead(
        input.leadId,
        `Lead moved to ${input.toStatus.replace(/_/g, " ").toLowerCase()}`,
        tx,
      );
    }
  });
}

/**
 * How long a lead spent in each stage, oldest first.
 *
 * Reads the history table, so it is exact rather than inferred from
 * `updatedAt`. The last entry is still open and has no duration.
 */
export async function leadStageDurations(leadId: string) {
  const changes = await prisma.leadStatusChange.findMany({
    where: { leadId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      fromStatus: true,
      toStatus: true,
      reason: true,
      createdAt: true,
      changedBy: { select: { name: true } },
    },
  });

  return changes.map((change, index) => {
    const next = changes[index + 1];
    return {
      id: change.id,
      fromStatus: change.fromStatus,
      toStatus: change.toStatus,
      reason: change.reason,
      at: change.createdAt,
      byName: change.changedBy?.name ?? null,
      /** Milliseconds spent in `toStatus`, or null while it is still current. */
      heldForMs: next ? next.createdAt.getTime() - change.createdAt.getTime() : null,
    };
  });
}
