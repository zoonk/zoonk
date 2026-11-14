-- Fixes the previous release proposed after 20261113151346_content_fix_batches become a batch of one, as that migration
-- made older fixes and core's fallback showed them: the fix's own id.
UPDATE "content_fixes" SET "batch_id" = "id" WHERE "batch_id" IS NULL;

-- AlterTable
ALTER TABLE "content_fixes" ALTER COLUMN "batch_id" SET NOT NULL;
