-- CreateEnum
CREATE TYPE "ContentManagementMode" AS ENUM ('ai', 'manual', 'pinned');

-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "management_mode" "ContentManagementMode" NOT NULL DEFAULT 'manual';

-- AlterTable
ALTER TABLE "chapters" ADD COLUMN     "management_mode" "ContentManagementMode" NOT NULL DEFAULT 'manual';

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "management_mode" "ContentManagementMode" NOT NULL DEFAULT 'manual';

-- AlterTable
ALTER TABLE "lessons" ADD COLUMN     "generation_version" INTEGER,
ADD COLUMN     "management_mode" "ContentManagementMode" NOT NULL DEFAULT 'manual';

-- Backfill existing AI-owned curriculum so runtime logic no longer depends on org slugs.
UPDATE "courses" AS "course"
SET "management_mode" = 'ai'
FROM "organizations" AS "organization"
WHERE "course"."organization_id" = "organization"."id"
  AND "organization"."slug" = 'ai';

UPDATE "chapters" AS "chapter"
SET "management_mode" = 'ai'
FROM "organizations" AS "organization"
WHERE "chapter"."organization_id" = "organization"."id"
  AND "organization"."slug" = 'ai';

UPDATE "lessons" AS "lesson"
SET
  "generation_version" = CASE
    WHEN "lesson"."generation_status" = 'completed' THEN 1
    ELSE NULL
  END,
  "management_mode" = 'ai'
FROM "organizations" AS "organization"
WHERE "lesson"."organization_id" = "organization"."id"
  AND "organization"."slug" = 'ai';

UPDATE "activities" AS "activity"
SET "management_mode" = 'ai'
FROM "organizations" AS "organization"
WHERE "activity"."organization_id" = "organization"."id"
  AND "organization"."slug" = 'ai';
