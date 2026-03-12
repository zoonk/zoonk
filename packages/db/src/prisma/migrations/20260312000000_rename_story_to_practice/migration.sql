-- Rename story activities to practice
BEGIN;
CREATE TYPE "ActivityKind_new" AS ENUM ('custom', 'background', 'explanation', 'quiz', 'examples', 'practice', 'challenge', 'vocabulary', 'grammar', 'reading', 'listening', 'review', 'language_practice');
ALTER TABLE "public"."activities" ALTER COLUMN "kind" DROP DEFAULT;
ALTER TABLE "activities" ALTER COLUMN "kind" TYPE "ActivityKind_new" USING (
  CASE "kind"::text
    WHEN 'story' THEN 'practice'::"ActivityKind_new"
    WHEN 'language_story' THEN 'language_practice'::"ActivityKind_new"
    ELSE "kind"::text::"ActivityKind_new"
  END
);
ALTER TYPE "ActivityKind" RENAME TO "ActivityKind_old";
ALTER TYPE "ActivityKind_new" RENAME TO "ActivityKind";
DROP TYPE "public"."ActivityKind_old";
ALTER TABLE "activities" ALTER COLUMN "kind" SET DEFAULT 'custom';
COMMIT;
