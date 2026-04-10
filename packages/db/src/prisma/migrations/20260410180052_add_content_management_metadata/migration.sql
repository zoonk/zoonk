-- CreateEnum
CREATE TYPE "ContentManagementMode" AS ENUM ('ai', 'manual', 'pinned');

-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "management_mode" "ContentManagementMode" NOT NULL DEFAULT 'manual',
ADD COLUMN     "stale_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "chapters" ADD COLUMN     "management_mode" "ContentManagementMode" NOT NULL DEFAULT 'manual',
ADD COLUMN     "stale_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "management_mode" "ContentManagementMode" NOT NULL DEFAULT 'manual',
ADD COLUMN     "stale_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "lessons" ADD COLUMN     "management_mode" "ContentManagementMode" NOT NULL DEFAULT 'manual',
ADD COLUMN     "stale_at" TIMESTAMP(3);

UPDATE "courses"
SET "management_mode" = 'ai'
FROM "organizations"
WHERE "courses"."organization_id" = "organizations"."id"
  AND "organizations"."slug" = 'ai';

UPDATE "chapters"
SET "management_mode" = 'ai'
FROM "organizations"
WHERE "chapters"."organization_id" = "organizations"."id"
  AND "organizations"."slug" = 'ai';

UPDATE "lessons"
SET "management_mode" = 'ai'
FROM "organizations"
WHERE "lessons"."organization_id" = "organizations"."id"
  AND "organizations"."slug" = 'ai';

UPDATE "activities"
SET "management_mode" = 'ai'
FROM "organizations"
WHERE "activities"."organization_id" = "organizations"."id"
  AND "organizations"."slug" = 'ai';
