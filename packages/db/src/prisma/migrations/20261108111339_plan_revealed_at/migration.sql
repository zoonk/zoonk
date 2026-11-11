-- AlterTable
ALTER TABLE "goals" ADD COLUMN     "plan_revealed_at" TIMESTAMP(3);

-- Goals from before the reveal was recorded count as seen, so no learner is sent back to one.
UPDATE "goals" SET "plan_revealed_at" = "created_at";
