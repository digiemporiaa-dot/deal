-- ─────────────────────────────────────────────────────────────
--  Vacationdeal — platform upgrade
--  2026-09-19
--
--  Additive only. This script creates two tables, adds nullable or
--  defaulted columns, and creates indexes. It never drops a table, drops a
--  column, or rewrites existing rows, so it is safe to run against a live
--  database with real bookings in it.
--
--  Every statement is idempotent (IF NOT EXISTS), so re-running it is a
--  no-op rather than an error.
--
--  How to apply
--  ────────────
--    Preferred (matches this project's existing workflow):
--        npm run db:push            # prisma db push, additive changes only
--
--    Or apply this file directly:
--        psql "$DATABASE_URL" -f prisma/sql/2026-09-19-platform-upgrade.sql
--
--  Take a backup first. Do NOT use `prisma migrate reset`.
-- ─────────────────────────────────────────────────────────────

BEGIN;

-- ── Admin activity / audit log ───────────────────────────────
CREATE TABLE IF NOT EXISTS "ActivityLog" (
  "id"          TEXT PRIMARY KEY,
  "userId"      TEXT,
  "userName"    TEXT,
  "userRole"    TEXT,
  "action"      TEXT NOT NULL,
  "entity"      TEXT NOT NULL,
  "entityId"    TEXT,
  "description" TEXT NOT NULL,
  "metadata"    JSONB,
  "ipAddress"   TEXT,
  "userAgent"   TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ActivityLog_userId_fkey'
  ) THEN
    ALTER TABLE "ActivityLog"
      ADD CONSTRAINT "ActivityLog_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ActivityLog_userId_idx"           ON "ActivityLog"("userId");
CREATE INDEX IF NOT EXISTS "ActivityLog_action_idx"           ON "ActivityLog"("action");
CREATE INDEX IF NOT EXISTS "ActivityLog_entity_idx"           ON "ActivityLog"("entity");
CREATE INDEX IF NOT EXISTS "ActivityLog_entity_entityId_idx"  ON "ActivityLog"("entity", "entityId");
CREATE INDEX IF NOT EXISTS "ActivityLog_createdAt_idx"        ON "ActivityLog"("createdAt");
CREATE INDEX IF NOT EXISTS "ActivityLog_userId_createdAt_idx" ON "ActivityLog"("userId", "createdAt");

-- ── Reusable SEO metadata ────────────────────────────────────
CREATE TABLE IF NOT EXISTS "SeoMeta" (
  "id"                 TEXT PRIMARY KEY,
  "entityType"         TEXT NOT NULL,
  "entityId"           TEXT NOT NULL,
  "seoTitle"           TEXT,
  "seoDescription"     TEXT,
  "canonicalUrl"       TEXT,
  "focusKeyword"       TEXT,
  "ogTitle"            TEXT,
  "ogDescription"      TEXT,
  "ogImage"            TEXT,
  "twitterTitle"       TEXT,
  "twitterDescription" TEXT,
  "twitterImage"       TEXT,
  "robotsIndex"        BOOLEAN NOT NULL DEFAULT true,
  "robotsFollow"       BOOLEAN NOT NULL DEFAULT true,
  "schemaType"         TEXT,
  "schemaJson"         JSONB,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "SeoMeta_entityType_entityId_key" ON "SeoMeta"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "SeoMeta_entityType_idx"  ON "SeoMeta"("entityType");
CREATE INDEX IF NOT EXISTS "SeoMeta_robotsIndex_idx" ON "SeoMeta"("robotsIndex");

-- ── User ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "User_isActive_idx" ON "User"("isActive");
CREATE INDEX IF NOT EXISTS "User_email_idx"    ON "User"("email");

-- ── Media library ────────────────────────────────────────────
ALTER TABLE "Media" ADD COLUMN IF NOT EXISTS "originalFilename" TEXT;
ALTER TABLE "Media" ADD COLUMN IF NOT EXISTS "title"            TEXT;
ALTER TABLE "Media" ADD COLUMN IF NOT EXISTS "caption"          TEXT;
ALTER TABLE "Media" ADD COLUMN IF NOT EXISTS "folder"           TEXT NOT NULL DEFAULT 'general';
ALTER TABLE "Media" ADD COLUMN IF NOT EXISTS "storageProvider"  TEXT NOT NULL DEFAULT 'local';
ALTER TABLE "Media" ADD COLUMN IF NOT EXISTS "storageKey"       TEXT;
ALTER TABLE "Media" ADD COLUMN IF NOT EXISTS "createdById"      TEXT;
ALTER TABLE "Media" ADD COLUMN IF NOT EXISTS "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Media_createdById_fkey') THEN
    ALTER TABLE "Media"
      ADD CONSTRAINT "Media_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Media_folder_idx"      ON "Media"("folder");
CREATE INDEX IF NOT EXISTS "Media_createdAt_idx"   ON "Media"("createdAt");
CREATE INDEX IF NOT EXISTS "Media_createdById_idx" ON "Media"("createdById");

-- Existing rows keep working: the stored URL doubles as the delete handle.
UPDATE "Media" SET "storageKey" = "url" WHERE "storageKey" IS NULL;

-- ── Redirects ────────────────────────────────────────────────
ALTER TABLE "Redirect" ADD COLUMN IF NOT EXISTS "statusCode" INTEGER NOT NULL DEFAULT 301;

-- Carry the old boolean across so existing rules keep their behaviour.
UPDATE "Redirect" SET "statusCode" = CASE WHEN "permanent" THEN 301 ELSE 302 END
WHERE "statusCode" = 301 AND "permanent" = false;

-- ── Leads: CRM and attribution ───────────────────────────────
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "priority"       TEXT NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "country"        TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "returnDate"     TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "adults"         INTEGER;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "children"       INTEGER;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "medium"         TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "campaign"       TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "term"           TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "content"        TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "gclid"          TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "fbclid"         TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "landingPage"    TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "referrer"       TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "lastActivityAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Lead_source_idx"               ON "Lead"("source");
CREATE INDEX IF NOT EXISTS "Lead_priority_idx"             ON "Lead"("priority");
CREATE INDEX IF NOT EXISTS "Lead_status_createdAt_idx"     ON "Lead"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Lead_assignedToId_status_idx"  ON "Lead"("assignedToId", "status");
CREATE INDEX IF NOT EXISTS "Lead_phone_idx"                ON "Lead"("phone");
CREATE INDEX IF NOT EXISTS "Lead_email_idx"                ON "Lead"("email");

-- Seed "last activity" from the timeline so sorting is meaningful straight away.
UPDATE "Lead" l
SET "lastActivityAt" = sub."latest"
FROM (
  SELECT "leadId", MAX("createdAt") AS "latest" FROM "LeadNote" GROUP BY "leadId"
) sub
WHERE l."id" = sub."leadId" AND l."lastActivityAt" IS NULL;

-- ── Lead timeline ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "LeadNote_leadId_createdAt_idx" ON "LeadNote"("leadId", "createdAt");
CREATE INDEX IF NOT EXISTS "LeadNote_authorId_idx"         ON "LeadNote"("authorId");
CREATE INDEX IF NOT EXISTS "LeadNote_type_idx"             ON "LeadNote"("type");
CREATE INDEX IF NOT EXISTS "LeadNote_createdAt_idx"        ON "LeadNote"("createdAt");

-- ── Bookings: attribution and reporting indexes ──────────────
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "source"      TEXT NOT NULL DEFAULT 'DIRECT';
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "medium"      TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "campaign"    TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "landingPage" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "referrer"    TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "gclid"       TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "fbclid"      TEXT;

CREATE INDEX IF NOT EXISTS "Booking_createdAt_idx"               ON "Booking"("createdAt");
CREATE INDEX IF NOT EXISTS "Booking_travelDate_idx"              ON "Booking"("travelDate");
CREATE INDEX IF NOT EXISTS "Booking_paymentStatus_createdAt_idx" ON "Booking"("paymentStatus", "createdAt");
CREATE INDEX IF NOT EXISTS "Booking_status_createdAt_idx"        ON "Booking"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Booking_source_idx"                  ON "Booking"("source");

-- ── Payments ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "Payment_createdAt_idx" ON "Payment"("createdAt");

-- ── Blog: editorial links for internal linking ───────────────
ALTER TABLE "BlogPost" ADD COLUMN IF NOT EXISTS "destinationId" TEXT;
ALTER TABLE "BlogPost" ADD COLUMN IF NOT EXISTS "packageId"     TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BlogPost_destinationId_fkey') THEN
    ALTER TABLE "BlogPost"
      ADD CONSTRAINT "BlogPost_destinationId_fkey"
      FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BlogPost_packageId_fkey') THEN
    ALTER TABLE "BlogPost"
      ADD CONSTRAINT "BlogPost_packageId_fkey"
      FOREIGN KEY ("packageId") REFERENCES "TravelPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "BlogPost_status_publishedAt_idx" ON "BlogPost"("status", "publishedAt");
CREATE INDEX IF NOT EXISTS "BlogPost_categoryId_idx"         ON "BlogPost"("categoryId");
CREATE INDEX IF NOT EXISTS "BlogPost_destinationId_idx"      ON "BlogPost"("destinationId");
CREATE INDEX IF NOT EXISTS "BlogPost_packageId_idx"          ON "BlogPost"("packageId");
CREATE INDEX IF NOT EXISTS "BlogPost_authorId_idx"           ON "BlogPost"("authorId");

-- ── Destinations ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "Destination_isPublished_name_idx" ON "Destination"("isPublished", "name");

-- ── Packages: themes used by the related-content engine ──────
ALTER TABLE "TravelPackage" ADD COLUMN IF NOT EXISTS "tags" TEXT NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS "TravelPackage_published_destinationId_idx" ON "TravelPackage"("published", "destinationId");
CREATE INDEX IF NOT EXISTS "TravelPackage_published_startingPrice_idx" ON "TravelPackage"("published", "startingPrice");
CREATE INDEX IF NOT EXISTS "TravelPackage_createdAt_idx"                ON "TravelPackage"("createdAt");

-- ── CMS pages ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "Page_status_idx" ON "Page"("status");

COMMIT;
