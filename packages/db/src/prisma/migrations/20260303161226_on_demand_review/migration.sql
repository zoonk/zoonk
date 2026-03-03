-- Merge languageReview into review
UPDATE activities SET kind = 'review' WHERE kind = 'language_review';

-- Delete pre-generated review steps (no longer needed)
DELETE FROM steps WHERE activity_id IN (
  SELECT id FROM activities WHERE kind = 'review'
);

-- Ensure all review activities are marked as completed
UPDATE activities SET generation_status = 'completed'
WHERE kind = 'review' AND generation_status != 'completed';

-- Remove languageReview from ActivityKind enum
-- Must drop default before changing type, then restore it
ALTER TABLE "activities" ALTER COLUMN "kind" DROP DEFAULT;
ALTER TYPE "ActivityKind" RENAME TO "ActivityKind_old";
CREATE TYPE "ActivityKind" AS ENUM ('custom', 'background', 'explanation', 'quiz', 'mechanics', 'examples', 'story', 'challenge', 'vocabulary', 'grammar', 'reading', 'listening', 'review', 'language_story');
ALTER TABLE "activities" ALTER COLUMN "kind" TYPE "ActivityKind" USING ("kind"::text::"ActivityKind");
ALTER TABLE "activities" ALTER COLUMN "kind" SET DEFAULT 'custom'::"ActivityKind";
DROP TYPE "ActivityKind_old";
