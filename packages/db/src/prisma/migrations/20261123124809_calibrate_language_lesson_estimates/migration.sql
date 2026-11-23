WITH calibrated AS (
  UPDATE library_lessons
  SET estimated_minutes = GREATEST(1, round(estimated_minutes * 0.84)),
      updated_at = CURRENT_TIMESTAMP
  WHERE target_language IS NOT NULL
    AND jsonb_typeof(spec->'screens') = 'array'
    AND spec->>'estimatedMinutes' = estimated_minutes::text
    AND estimated_minutes <> GREATEST(1, round(estimated_minutes * 0.84))
  RETURNING id, target_language
)
UPDATE plans
SET source_version = source_version + 1
WHERE goal_id IN (
  SELECT id FROM goals WHERE target_language IN (SELECT target_language FROM calibrated)
)
OR id IN (
  SELECT plan_id FROM plan_items WHERE lesson_id IN (SELECT id FROM calibrated)
);
