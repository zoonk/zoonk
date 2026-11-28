-- Answers still without a value were written by the previous release after 20261125104708_bank_lesson_checks ran.
-- That migration set every earlier answer to `step_id IS NOT NULL`, and core read a null the same way.
UPDATE "attempts" SET "from_lesson" = ("step_id" IS NOT NULL) WHERE "from_lesson" IS NULL;

-- DropIndex
DROP INDEX "attempts_test_answers_user_id_skill_id_idx";

-- AlterTable
ALTER TABLE "attempts" ALTER COLUMN "from_lesson" SET NOT NULL;

-- CreateIndex
CREATE INDEX "attempts_test_answers_user_id_skill_id_idx" ON "attempts"("user_id", "skill_id") WHERE ((mock_exam_id IS NULL) AND (is_placement OR ((item_id IS NOT NULL) AND (NOT from_lesson) AND (study_session_id IS NULL))));
