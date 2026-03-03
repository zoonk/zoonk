-- Update existing mechanics activities to examples
UPDATE "activities" SET "kind" = 'examples' WHERE "kind" = 'mechanics';

BEGIN;
CREATE TYPE "ActivityKind_new" AS ENUM ('custom', 'background', 'explanation', 'quiz', 'examples', 'story', 'challenge', 'vocabulary', 'grammar', 'reading', 'listening', 'review', 'language_story');
ALTER TABLE "public"."activities" ALTER COLUMN "kind" DROP DEFAULT;
ALTER TABLE "activities" ALTER COLUMN "kind" TYPE "ActivityKind_new" USING ("kind"::text::"ActivityKind_new");
ALTER TYPE "ActivityKind" RENAME TO "ActivityKind_old";
ALTER TYPE "ActivityKind_new" RENAME TO "ActivityKind";
DROP TYPE "public"."ActivityKind_old";
ALTER TABLE "activities" ALTER COLUMN "kind" SET DEFAULT 'custom';
COMMIT;
