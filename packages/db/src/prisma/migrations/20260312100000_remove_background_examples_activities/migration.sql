-- Delete existing background and examples activities
DELETE FROM "activities" WHERE "kind" IN ('background', 'examples');

BEGIN;
CREATE TYPE "ActivityKind_new" AS ENUM ('custom', 'explanation', 'quiz', 'practice', 'challenge', 'vocabulary', 'grammar', 'reading', 'listening', 'review', 'language_practice');
ALTER TABLE "public"."activities" ALTER COLUMN "kind" DROP DEFAULT;
ALTER TABLE "activities" ALTER COLUMN "kind" TYPE "ActivityKind_new" USING ("kind"::text::"ActivityKind_new");
ALTER TYPE "ActivityKind" RENAME TO "ActivityKind_old";
ALTER TYPE "ActivityKind_new" RENAME TO "ActivityKind";
DROP TYPE "public"."ActivityKind_old";
ALTER TABLE "activities" ALTER COLUMN "kind" SET DEFAULT 'custom';
COMMIT;
