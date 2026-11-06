-- A lesson's numeric questions join the practice bank with its screens and now leave it with them.
-- Until now a replaced, regenerated or set-aside lesson left its questions behind, some with a wrong
-- answer. A lesson writer's question (its run is a `lesson-writer` or `lesson-fix` call) that no
-- current screen of a lesson still taught asks is one of those, so it's removed.
DELETE FROM "items" AS "item"
WHERE EXISTS (
    SELECT 1
    FROM "ai_calls" AS "call"
    WHERE "call"."run_id" = "item"."run_id"
      AND "call"."task" IN ('lesson-writer', 'lesson-fix')
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "library_steps" AS "step"
    JOIN "library_lessons" AS "lesson" ON "lesson"."id" = "step"."lesson_id"
    WHERE "step"."item_id" = "item"."id"
      AND "step"."retired_at" IS NULL
      AND NOT "step"."staged"
      AND "lesson"."set_aside_at" IS NULL
  );
