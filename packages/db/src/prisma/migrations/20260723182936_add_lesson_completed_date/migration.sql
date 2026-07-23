-- AlterTable
ALTER TABLE "lesson_progress" ADD COLUMN     "completed_date" DATE;

-- Existing rows predate the learner-local date field, so UTC is the only
-- recoverable calendar date. New completions persist the exact local date.
UPDATE "lesson_progress"
SET "completed_date" = "completed_at"::DATE
WHERE "completed_at" IS NOT NULL;

-- CreateIndex
CREATE INDEX "lesson_progress_user_id_completed_date_idx" ON "lesson_progress"("user_id", "completed_date");
