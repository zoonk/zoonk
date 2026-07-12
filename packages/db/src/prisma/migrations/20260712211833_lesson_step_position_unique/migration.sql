BEGIN;

-- Prevent lesson saves and attempts from changing while duplicate rows are reconciled.
LOCK TABLE "steps" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "step_attempts" IN SHARE ROW EXCLUSIVE MODE;

-- Preserve learner history while removing only content-identical duplicate steps.
-- Any heterogeneous position collision remains and makes the unique index fail safely.
WITH "ranked_steps" AS (
  SELECT
    "id",
    FIRST_VALUE("id") OVER (
      PARTITION BY
        "lesson_id",
        "position",
        "word_id",
        "sentence_id",
        "chapter_word_id",
        "chapter_sentence_id",
        "kind",
        "is_published",
        "content"
      ORDER BY "created_at", "id"
    ) AS "retained_id",
    ROW_NUMBER() OVER (
      PARTITION BY
        "lesson_id",
        "position",
        "word_id",
        "sentence_id",
        "chapter_word_id",
        "chapter_sentence_id",
        "kind",
        "is_published",
        "content"
      ORDER BY "created_at", "id"
    ) AS "duplicate_rank"
  FROM "steps"
),
"duplicate_steps" AS (
  SELECT "id", "retained_id"
  FROM "ranked_steps"
  WHERE "duplicate_rank" > 1
)
UPDATE "step_attempts"
SET "step_id" = "duplicate_steps"."retained_id"
FROM "duplicate_steps"
WHERE "step_attempts"."step_id" = "duplicate_steps"."id";

WITH "ranked_steps" AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY
        "lesson_id",
        "position",
        "word_id",
        "sentence_id",
        "chapter_word_id",
        "chapter_sentence_id",
        "kind",
        "is_published",
        "content"
      ORDER BY "created_at", "id"
    ) AS "duplicate_rank"
  FROM "steps"
)
DELETE FROM "steps"
USING "ranked_steps"
WHERE "steps"."id" = "ranked_steps"."id"
  AND "ranked_steps"."duplicate_rank" > 1;

-- DropIndex
DROP INDEX "steps_lesson_id_position_idx";

-- CreateIndex
CREATE UNIQUE INDEX "steps_lesson_id_position_key" ON "steps"("lesson_id", "position");

COMMIT;
