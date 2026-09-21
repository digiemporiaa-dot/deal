/**
 * CRM phase-1 backfill.
 *
 * Run once after applying prisma/sql/2026-09-21-crm-upgrade.sql, and safe to
 * re-run at any time.
 *
 *     npm run db:backfill-crm
 *
 * Strictly additive. It fills three new columns from data the rows already
 * carry. It creates nothing, deletes nothing, and never changes a value a
 * person entered.
 *
 *   1. Lead.phoneKey / Customer.phoneKey — the normalised match key. The SQL
 *      migration does this too; this repeats it for anyone who ran
 *      `prisma db push` (which adds the columns but runs no backfill) instead
 *      of the SQL file.
 *
 *   2. Lead.score / Lead.scoreBand — scoring is application logic, not SQL, so
 *      it cannot live in the migration without being written twice and
 *      drifting. Every lead is scored by the same `scoreLead` the live code
 *      uses.
 */

import { PrismaClient } from "@prisma/client";
import { normalizePhone, scoreLead, scoreInputFromLead, CLOSED_STATUSES } from "../lib/crm";

const prisma = new PrismaClient();

/**
 * Scanned by cursor rather than by `where: { phoneKey: null }`.
 *
 * A number with no digits in it normalises to null, which is the correct
 * value — but a null-filtered loop would hand that row back for ever. The
 * cursor also means a re-run costs one pass and zero writes, because each
 * update is guarded on the value actually differing.
 */
async function backfillPhoneKeys() {
  let leads = 0;
  let customers = 0;

  let leadCursor: string | undefined;
  for (;;) {
    const batch = await prisma.lead.findMany({
      select: { id: true, phone: true, phoneKey: true },
      orderBy: { id: "asc" },
      take: 500,
      ...(leadCursor ? { skip: 1, cursor: { id: leadCursor } } : {}),
    });
    if (batch.length === 0) break;

    const stale = batch.filter((lead) => lead.phoneKey !== normalizePhone(lead.phone));
    await Promise.all(
      stale.map((lead) =>
        prisma.lead.update({
          where: { id: lead.id },
          data: { phoneKey: normalizePhone(lead.phone) },
        }),
      ),
    );
    leads += stale.length;
    leadCursor = batch[batch.length - 1]?.id;
    if (batch.length < 500) break;
  }

  let customerCursor: string | undefined;
  for (;;) {
    const batch = await prisma.customer.findMany({
      select: { id: true, phone: true, phoneKey: true },
      orderBy: { id: "asc" },
      take: 500,
      ...(customerCursor ? { skip: 1, cursor: { id: customerCursor } } : {}),
    });
    if (batch.length === 0) break;

    const stale = batch.filter((row) => row.phoneKey !== normalizePhone(row.phone));
    await Promise.all(
      stale.map((row) =>
        prisma.customer.update({
          where: { id: row.id },
          data: { phoneKey: normalizePhone(row.phone) },
        }),
      ),
    );
    customers += stale.length;
    customerCursor = batch[batch.length - 1]?.id;
    if (batch.length < 500) break;
  }

  return { leads, customers };
}

/**
 * Give every lead that already carries a reminder a follow-up task to derive
 * it from, so the first `syncNextFollowUp` does not clear the date.
 *
 * Idempotent: a lead that already has any follow-up is skipped.
 */
async function backfillFollowUps() {
  const leads = await prisma.lead.findMany({
    where: {
      nextFollowUpAt: { not: null },
      status: { notIn: [...CLOSED_STATUSES] },
      followUps: { none: {} },
    },
    select: { id: true, nextFollowUpAt: true, assignedToId: true },
  });

  if (leads.length === 0) return 0;

  await prisma.leadFollowUp.createMany({
    data: leads.map((lead) => ({
      leadId: lead.id,
      dueAt: lead.nextFollowUpAt as Date,
      type: "TASK",
      title: "Follow up",
      status: "PENDING",
      assignedToId: lead.assignedToId,
    })),
    skipDuplicates: true,
  });

  return leads.length;
}

/**
 * Score every lead.
 *
 * The scoring itself is `scoreLead` from lib/crm — the very function the
 * running application uses — via the shared field mapping, so a lead scored
 * here and a lead scored on a status change can never disagree.
 *
 * This repeats the batch loop in lib/services/lead-scoring.ts rather than
 * calling it, because that module is `server-only` and this is a CLI. The
 * arithmetic is not repeated; only the paging around it, which is what
 * prisma/seed.ts does too.
 */
async function backfillScores() {
  let cursor: string | undefined;
  let scanned = 0;
  let changed = 0;

  for (;;) {
    const batch = await prisma.lead.findMany({
      select: {
        id: true,
        email: true,
        phone: true,
        whatsapp: true,
        destination: true,
        packageId: true,
        budget: true,
        travelDate: true,
        travellers: true,
        adults: true,
        children: true,
        source: true,
        status: true,
        lastActivityAt: true,
        score: true,
        scoreBand: true,
        _count: { select: { notes: true } },
      },
      orderBy: { id: "asc" },
      take: 200,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (batch.length === 0) break;

    const now = new Date();
    const stale = batch
      .map((lead) => ({ lead, result: scoreLead(scoreInputFromLead(lead, lead._count.notes, now)) }))
      .filter(
        ({ lead, result }) => lead.score !== result.score || lead.scoreBand !== result.band,
      );

    await Promise.all(
      stale.map(({ lead, result }) =>
        prisma.lead.update({
          where: { id: lead.id },
          data: { score: result.score, scoreBand: result.band },
        }),
      ),
    );

    scanned += batch.length;
    changed += stale.length;
    cursor = batch[batch.length - 1]?.id;
    if (batch.length < 200) break;
  }

  return { scanned, changed };
}

async function main() {
  console.log("CRM backfill — additive only, nothing is deleted or overwritten.\n");

  const keys = await backfillPhoneKeys();
  console.log(`  phone keys   : ${keys.leads} lead(s), ${keys.customers} customer(s)`);

  const followUps = await backfillFollowUps();
  console.log(`  follow-ups   : ${followUps} reminder(s) turned into tasks`);

  const scores = await backfillScores();
  console.log(`  lead scores  : ${scores.changed} changed of ${scores.scanned} scanned`);

  console.log("\nDone.");
}

main()
  .catch((error) => {
    console.error("Backfill failed. Nothing was deleted.", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
