-- An owner-approved, one-time exception to never rewriting stored lessons: only a new plan splits a
-- dense one into one idea per screen. A lesson a run is planning or writing is left alone, so a
-- learner waiting on it isn't interrupted; it, and any plan the previous deployment saves after this
-- runs, keeps the old design.
WITH "old_design" AS (
  SELECT "lesson"."id"
  FROM "library_lessons" AS "lesson"
  WHERE "lesson"."target_language" IS NULL
    AND "lesson"."set_aside_at" IS NULL
    AND "lesson"."spec" ? 'screens'
    AND NOT ("lesson"."spec" ? 'plannedAt')
    AND "lesson"."spec_status" <> 'running'
    AND "lesson"."content_status" <> 'running'
),
"retired" AS (
  UPDATE "library_steps"
  SET "retired_at" = CURRENT_TIMESTAMP
  WHERE "lesson_id" IN (SELECT "id" FROM "old_design") AND "retired_at" IS NULL
)
UPDATE "library_lessons"
SET
  "spec_status" = 'pending',
  "spec_run_id" = NULL,
  "content_status" = 'pending',
  "content_run_id" = NULL,
  "held_back_drafts" = '[]',
  "updated_at" = CURRENT_TIMESTAMP
WHERE "id" IN (SELECT "id" FROM "old_design");
