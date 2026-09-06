-- AlterTable
ALTER TABLE "lesson_questions" ADD COLUMN "step_number" INTEGER;

-- Backfill immutable presentation metadata before snapshots stop being loaded for thread reads.
UPDATE "lesson_questions"
SET "step_number" = ("context_snapshot"->'step'->>'stepNumber')::INTEGER
WHERE "context_kind" <> 'lesson';

-- Preserve existing mistake questions in the answer context that replaced them.
UPDATE "lesson_questions"
SET
    "context_kind" = 'answer',
    "context_snapshot" = jsonb_set(
        jsonb_set("context_snapshot" - 'mistake', '{scope,kind}', '"answer"'::jsonb),
        '{answer}',
        ("context_snapshot"->'mistake') || '{"isCorrect": false}'::jsonb
    )
WHERE "context_kind" = 'mistake';

-- AlterEnum
BEGIN;
CREATE TYPE "LessonQuestionContextKind_new" AS ENUM ('lesson', 'step', 'answer');
ALTER TABLE "lesson_questions" ALTER COLUMN "context_kind" TYPE "LessonQuestionContextKind_new" USING ("context_kind"::text::"LessonQuestionContextKind_new");
ALTER TYPE "LessonQuestionContextKind" RENAME TO "LessonQuestionContextKind_old";
ALTER TYPE "LessonQuestionContextKind_new" RENAME TO "LessonQuestionContextKind";
DROP TYPE "public"."LessonQuestionContextKind_old";
COMMIT;
