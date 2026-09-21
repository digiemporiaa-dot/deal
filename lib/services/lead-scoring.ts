import "server-only";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { scoreLead, scoreInputFromLead, type LeadScore } from "@/lib/crm";
import type { Prisma } from "@prisma/client";

/**
 * Persisting the lead score.
 *
 * `scoreLead` in lib/crm.ts does the arithmetic and is pure; this module is
 * only responsible for reading the inputs and writing the result back. The
 * score is stored rather than computed on read so the CRM list can sort and
 * filter on it in the database — a hundred thousand leads cannot be scored in
 * the page handler.
 *
 * Because it is stored, it goes stale. Every write path that changes a scoring
 * input calls `rescoreLead`, and `rescoreAllLeads` exists for the cases that
 * do not (a lead whose travel date simply got closer while nobody touched it).
 */

const SCORE_SELECT = {
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
  _count: { select: { notes: true } },
} satisfies Prisma.LeadSelect;

type ScorableLead = Prisma.LeadGetPayload<{ select: typeof SCORE_SELECT }>;

/** Score a row that has already been loaded. */
export function scoreFor(lead: ScorableLead, now?: Date): LeadScore {
  return scoreLead(scoreInputFromLead(lead, lead._count.notes, now));
}

/**
 * Recompute and store one lead's score.
 *
 * Never throws: a scoring failure must not roll back the status change, note
 * or email that triggered it. A stale score is a cosmetic problem; a lost
 * note is not.
 */
export async function rescoreLead(leadId: string): Promise<LeadScore | null> {
  try {
    const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: SCORE_SELECT });
    if (!lead) return null;

    const result = scoreFor(lead);
    await prisma.lead.update({
      where: { id: leadId },
      data: { score: result.score, scoreBand: result.band },
    });
    return result;
  } catch (error) {
    logger.error("lead.rescore_failed", { leadId, error });
    return null;
  }
}

/**
 * Recompute every lead's score, in batches.
 *
 * Called by the nightly CRM cron, because a stored score drifts on its own —
 * a trip six months out in March is three weeks out in August and nobody
 * edited the lead. Writes one row at a time inside a batch rather than one
 * statement for all of them, because the score depends on per-row inputs that
 * SQL would have to re-derive.
 */
export async function rescoreAllLeads(options: { batchSize?: number } = {}) {
  const batchSize = Math.min(Math.max(options.batchSize ?? 200, 1), 1000);
  let cursor: string | undefined;
  let scanned = 0;
  let changed = 0;

  for (;;) {
    const batch: ScorableLead[] = await prisma.lead.findMany({
      select: SCORE_SELECT,
      orderBy: { id: "asc" },
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (batch.length === 0) break;

    const now = new Date();
    const updates = batch.map((lead) => {
      const result = scoreFor(lead, now);
      return prisma.lead.updateMany({
        // The guard makes this a no-op when the score has not moved, which
        // keeps a nightly run from touching every row in the table.
        where: { id: lead.id, NOT: { score: result.score, scoreBand: result.band } },
        data: { score: result.score, scoreBand: result.band },
      });
    });

    const results = await Promise.all(updates);
    changed += results.reduce((sum, result) => sum + result.count, 0);
    scanned += batch.length;
    cursor = batch[batch.length - 1]?.id;
    if (batch.length < batchSize) break;
  }

  logger.info("lead.rescore_all", { scanned, changed });
  return { scanned, changed };
}
