-- Reset non-language AI courses so they can be generated again.
-- Language courses are identified by target_language and must keep their generated curriculum.

UPDATE "courses"
SET
    "generation_status" = 'pending',
    "generation_run_id" = NULL,
    "updated_at" = CURRENT_TIMESTAMP
WHERE "target_language" IS NULL;

-- Topic start requests should remain as prompt/cache records, but stale
-- completed/running states would otherwise skip the course-generation workflow.
UPDATE "course_start_requests"
SET
    "generation_status" = 'pending',
    "generation_run_id" = NULL,
    "updated_at" = CURRENT_TIMESTAMP
WHERE "scope" = 'topic'
  AND "generation_status" IS NOT NULL;

-- Chapter deletion cascades to lessons, steps, lesson progress, chapter
-- completions, and chapter-scoped language resources.
DELETE FROM "chapters"
USING "courses"
WHERE "chapters"."course_id" = "courses"."id"
  AND "courses"."target_language" IS NULL;
