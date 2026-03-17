-- Delete language_practice activities (steps cascade automatically)
DELETE FROM "activities" WHERE "kind" = 'language_practice';

-- Remove language_practice from ActivityKind enum
ALTER TABLE "activities" ALTER COLUMN "kind" DROP DEFAULT;
CREATE TYPE "ActivityKind_new" AS ENUM ('custom', 'explanation', 'quiz', 'practice', 'challenge', 'vocabulary', 'grammar', 'reading', 'listening', 'translation', 'review');
ALTER TABLE "activities" ALTER COLUMN "kind" TYPE "ActivityKind_new" USING ("kind"::text::"ActivityKind_new");
ALTER TYPE "ActivityKind" RENAME TO "ActivityKind_old";
ALTER TYPE "ActivityKind_new" RENAME TO "ActivityKind";
DROP TYPE "ActivityKind_old";
ALTER TABLE "activities" ALTER COLUMN "kind" SET DEFAULT 'custom';
