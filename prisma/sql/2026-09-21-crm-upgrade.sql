-- ─────────────────────────────────────────────────────────────
--  Vacationdeal — CRM upgrade (phase 1)
--  2026-09-21
--
--  Additive only. This script adds nullable or defaulted columns, creates
--  two new tables and their indexes, and backfills the new columns from
--  data that is already in the row. It never drops a table, drops a column,
--  or changes a value a person entered, so it is safe to run against a live
--  database with real leads and bookings in it.
--
--  Every statement is idempotent — columns and indexes use IF NOT EXISTS,
--  and the two backfills are guarded so re-running is a no-op rather than a
--  duplicate or an overwrite.
--
--  No lead status is renamed. PROPOSAL_SENT and CONVERTED keep their stored
--  values (the UI relabels them "Proposal" and "Won"); NEGOTIATION and JUNK
--  are simply two new values the application may now write.
--
--  How to apply
--  ────────────
--    Preferred (matches this project's existing workflow):
--        npm run db:push            # prisma db push, additive changes only
--
--    Or apply this file directly:
--        psql "$DATABASE_URL" -f prisma/sql/2026-09-21-crm-upgrade.sql
--
--  Take a backup first. Do NOT use `prisma migrate reset`.
-- ─────────────────────────────────────────────────────────────

BEGIN;

-- ── Lead: qualification, interest and lifecycle columns ──────
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "phoneKey"      TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "rooms"         INTEGER;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "tripType"      TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "tags"          TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "score"         INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "scoreBand"     TEXT NOT NULL DEFAULT 'COLD';
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "packageId"     TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "destinationId" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "customerId"    TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "convertedAt"   TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "lostReason"    TEXT;

-- ── Customer: the same phone key, so a lead can be matched to one ──
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "phoneKey" TEXT;

-- ── Follow-up tasks ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "LeadFollowUp" (
  "id"           TEXT PRIMARY KEY,
  "leadId"       TEXT NOT NULL,
  "dueAt"        TIMESTAMP(3) NOT NULL,
  "type"         TEXT NOT NULL DEFAULT 'CALL',
  "title"        TEXT NOT NULL,
  "note"         TEXT,
  "status"       TEXT NOT NULL DEFAULT 'PENDING',
  "assignedToId" TEXT,
  "createdById"  TEXT,
  "completedAt"  TIMESTAMP(3),
  "outcome"      TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "LeadFollowUp_leadId_idx"                    ON "LeadFollowUp"("leadId");
CREATE INDEX IF NOT EXISTS "LeadFollowUp_leadId_status_idx"             ON "LeadFollowUp"("leadId", "status");
CREATE INDEX IF NOT EXISTS "LeadFollowUp_status_dueAt_idx"              ON "LeadFollowUp"("status", "dueAt");
CREATE INDEX IF NOT EXISTS "LeadFollowUp_assignedToId_status_dueAt_idx" ON "LeadFollowUp"("assignedToId", "status", "dueAt");
CREATE INDEX IF NOT EXISTS "LeadFollowUp_dueAt_idx"                     ON "LeadFollowUp"("dueAt");

-- ── Pipeline history ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "LeadStatusChange" (
  "id"          TEXT PRIMARY KEY,
  "leadId"      TEXT NOT NULL,
  "fromStatus"  TEXT,
  "toStatus"    TEXT NOT NULL,
  "changedById" TEXT,
  "reason"      TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "LeadStatusChange_leadId_createdAt_idx"   ON "LeadStatusChange"("leadId", "createdAt");
CREATE INDEX IF NOT EXISTS "LeadStatusChange_toStatus_createdAt_idx" ON "LeadStatusChange"("toStatus", "createdAt");
CREATE INDEX IF NOT EXISTS "LeadStatusChange_createdAt_idx"          ON "LeadStatusChange"("createdAt");

-- ── Foreign keys ─────────────────────────────────────────────
-- Added separately so the columns above exist even on a database where a
-- constraint cannot be created. Every one is ON DELETE SET NULL or CASCADE
-- to a child row; none can delete a Lead, Customer, Package or Destination.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Lead_packageId_fkey') THEN
    ALTER TABLE "Lead" ADD CONSTRAINT "Lead_packageId_fkey"
      FOREIGN KEY ("packageId") REFERENCES "TravelPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Lead_destinationId_fkey') THEN
    ALTER TABLE "Lead" ADD CONSTRAINT "Lead_destinationId_fkey"
      FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Lead_customerId_fkey') THEN
    ALTER TABLE "Lead" ADD CONSTRAINT "Lead_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LeadFollowUp_leadId_fkey') THEN
    ALTER TABLE "LeadFollowUp" ADD CONSTRAINT "LeadFollowUp_leadId_fkey"
      FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LeadFollowUp_assignedToId_fkey') THEN
    ALTER TABLE "LeadFollowUp" ADD CONSTRAINT "LeadFollowUp_assignedToId_fkey"
      FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LeadFollowUp_createdById_fkey') THEN
    ALTER TABLE "LeadFollowUp" ADD CONSTRAINT "LeadFollowUp_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LeadStatusChange_leadId_fkey') THEN
    ALTER TABLE "LeadStatusChange" ADD CONSTRAINT "LeadStatusChange_leadId_fkey"
      FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LeadStatusChange_changedById_fkey') THEN
    ALTER TABLE "LeadStatusChange" ADD CONSTRAINT "LeadStatusChange_changedById_fkey"
      FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ── New indexes on Lead / Customer ───────────────────────────
CREATE INDEX IF NOT EXISTS "Lead_phoneKey_idx"         ON "Lead"("phoneKey");
CREATE INDEX IF NOT EXISTS "Lead_customerId_idx"       ON "Lead"("customerId");
CREATE INDEX IF NOT EXISTS "Lead_packageId_idx"        ON "Lead"("packageId");
CREATE INDEX IF NOT EXISTS "Lead_destinationId_idx"    ON "Lead"("destinationId");
CREATE INDEX IF NOT EXISTS "Lead_convertedAt_idx"      ON "Lead"("convertedAt");
CREATE INDEX IF NOT EXISTS "Lead_scoreBand_status_idx" ON "Lead"("scoreBand", "status");
CREATE INDEX IF NOT EXISTS "Lead_status_score_idx"     ON "Lead"("status", "score");
CREATE INDEX IF NOT EXISTS "Lead_lastActivityAt_idx"   ON "Lead"("lastActivityAt");
CREATE INDEX IF NOT EXISTS "Customer_phoneKey_idx"     ON "Customer"("phoneKey");

-- ── Backfill 1: phone keys ───────────────────────────────────
-- Derived from a column that is already there. Guarded on IS NULL so a
-- second run does nothing and a key the application has since written by
-- hand is never clobbered.
UPDATE "Lead"
   SET "phoneKey" = NULLIF(RIGHT(regexp_replace("phone", '[^0-9]', '', 'g'), 10), '')
 WHERE "phoneKey" IS NULL;

UPDATE "Customer"
   SET "phoneKey" = NULLIF(RIGHT(regexp_replace("phone", '[^0-9]', '', 'g'), 10), '')
 WHERE "phoneKey" IS NULL;

-- ── Backfill 2: existing reminders become follow-up tasks ────
-- `Lead.nextFollowUpAt` is now derived from the earliest PENDING task, so
-- every lead that already carries a reminder needs a task to derive it from
-- — otherwise the first sync would silently clear the date. The id is a
-- deterministic hash of the lead, which makes the insert idempotent on its
-- own as well as through the NOT EXISTS guard.
INSERT INTO "LeadFollowUp" ("id", "leadId", "dueAt", "type", "title", "status", "assignedToId", "createdAt", "updatedAt")
SELECT
  'lfu_migrated_' || md5(l."id"),
  l."id",
  l."nextFollowUpAt",
  'TASK',
  'Follow up',
  'PENDING',
  l."assignedToId",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Lead" l
WHERE l."nextFollowUpAt" IS NOT NULL
  AND l."status" NOT IN ('CONVERTED', 'LOST', 'JUNK')
  AND NOT EXISTS (SELECT 1 FROM "LeadFollowUp" f WHERE f."leadId" = l."id");

COMMIT;
