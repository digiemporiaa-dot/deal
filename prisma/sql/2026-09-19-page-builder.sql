-- ─────────────────────────────────────────────────────────────
--  Vacationdeal — page builder (CMS)
--  2026-09-19
--
--  Additive only: three new tables plus nullable columns on Page. No table
--  is dropped, no column is removed, and no existing row is rewritten, so
--  pages created before the builder keep rendering from `content`/`sections`.
--
--  Run AFTER 2026-09-19-platform-upgrade.sql.
--
--    psql "$DATABASE_URL" -f prisma/sql/2026-09-19-page-builder.sql
--
--  Or let Prisma apply both at once:  npm run db:push
--
--  Every statement is idempotent, so re-running is a no-op.
-- ─────────────────────────────────────────────────────────────

BEGIN;

-- ── Page: builder content, draft/published split, authorship ──
ALTER TABLE "Page" ADD COLUMN IF NOT EXISTS "draftContent"     JSONB;
ALTER TABLE "Page" ADD COLUMN IF NOT EXISTS "publishedContent" JSONB;
ALTER TABLE "Page" ADD COLUMN IF NOT EXISTS "template"         TEXT;
ALTER TABLE "Page" ADD COLUMN IF NOT EXISTS "publishedAt"      TIMESTAMP(3);
ALTER TABLE "Page" ADD COLUMN IF NOT EXISTS "createdById"      TEXT;
ALTER TABLE "Page" ADD COLUMN IF NOT EXISTS "updatedById"      TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Page_createdById_fkey') THEN
    ALTER TABLE "Page" ADD CONSTRAINT "Page_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Page_updatedById_fkey') THEN
    ALTER TABLE "Page" ADD CONSTRAINT "Page_updatedById_fkey"
      FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Page_updatedAt_idx"   ON "Page"("updatedAt");
CREATE INDEX IF NOT EXISTS "Page_template_idx"    ON "Page"("template");
CREATE INDEX IF NOT EXISTS "Page_createdById_idx" ON "Page"("createdById");
CREATE INDEX IF NOT EXISTS "Page_updatedById_idx" ON "Page"("updatedById");

-- Existing published pages get a publication date so the admin list can sort
-- by it without a null-handling special case.
UPDATE "Page" SET "publishedAt" = "updatedAt"
WHERE "publishedAt" IS NULL AND "status" = 'PUBLISHED';

-- ── Page revisions ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "PageRevision" (
  "id"          TEXT PRIMARY KEY,
  "pageId"      TEXT NOT NULL,
  "version"     INTEGER NOT NULL,
  "content"     JSONB NOT NULL,
  "reason"      TEXT NOT NULL DEFAULT 'manual',
  "note"        TEXT,
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PageRevision_pageId_fkey') THEN
    ALTER TABLE "PageRevision" ADD CONSTRAINT "PageRevision_pageId_fkey"
      FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PageRevision_createdById_fkey') THEN
    ALTER TABLE "PageRevision" ADD CONSTRAINT "PageRevision_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "PageRevision_pageId_version_key" ON "PageRevision"("pageId", "version");
CREATE INDEX IF NOT EXISTS "PageRevision_pageId_createdAt_idx"      ON "PageRevision"("pageId", "createdAt");
CREATE INDEX IF NOT EXISTS "PageRevision_createdById_idx"           ON "PageRevision"("createdById");

-- ── Reusable sections ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ReusableSection" (
  "id"          TEXT PRIMARY KEY,
  "name"        TEXT NOT NULL,
  "slug"        TEXT NOT NULL,
  "description" TEXT,
  "content"     JSONB NOT NULL,
  "status"      TEXT NOT NULL DEFAULT 'PUBLISHED',
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReusableSection_createdById_fkey') THEN
    ALTER TABLE "ReusableSection" ADD CONSTRAINT "ReusableSection_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "ReusableSection_slug_key"        ON "ReusableSection"("slug");
CREATE INDEX IF NOT EXISTS "ReusableSection_status_idx"             ON "ReusableSection"("status");
CREATE INDEX IF NOT EXISTS "ReusableSection_updatedAt_idx"          ON "ReusableSection"("updatedAt");
CREATE INDEX IF NOT EXISTS "ReusableSection_createdById_idx"        ON "ReusableSection"("createdById");

-- ── Templates ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "PageTemplate" (
  "id"          TEXT PRIMARY KEY,
  "name"        TEXT NOT NULL,
  "slug"        TEXT NOT NULL,
  "description" TEXT,
  "kind"        TEXT NOT NULL DEFAULT 'section',
  "category"    TEXT NOT NULL DEFAULT 'General',
  "content"     JSONB NOT NULL,
  "isBuiltIn"   BOOLEAN NOT NULL DEFAULT false,
  "thumbnail"   TEXT,
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PageTemplate_createdById_fkey') THEN
    ALTER TABLE "PageTemplate" ADD CONSTRAINT "PageTemplate_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "PageTemplate_slug_key"     ON "PageTemplate"("slug");
CREATE INDEX IF NOT EXISTS "PageTemplate_kind_idx"            ON "PageTemplate"("kind");
CREATE INDEX IF NOT EXISTS "PageTemplate_category_idx"        ON "PageTemplate"("category");
CREATE INDEX IF NOT EXISTS "PageTemplate_createdById_idx"     ON "PageTemplate"("createdById");

COMMIT;
