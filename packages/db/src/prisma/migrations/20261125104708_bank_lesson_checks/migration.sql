-- DropIndex
DROP INDEX "attempts_test_answers_user_id_skill_id_idx";

-- AlterTable
ALTER TABLE "attempts" ADD COLUMN     "from_lesson" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "attempts_test_answers_user_id_skill_id_idx" ON "attempts"("user_id", "skill_id") WHERE ((mock_exam_id IS NULL) AND (is_placement OR ((item_id IS NOT NULL) AND (NOT from_lesson) AND (step_id IS NULL) AND (study_session_id IS NULL))));

UPDATE attempts SET from_lesson = true WHERE step_id IS NOT NULL;

-- Backfill standalone lesson checks
WITH checks AS (
  SELECT s.id AS step_id, uuidv7() AS item_id, s.skill_id, l.language, s.content,
         s.model, s.prompt_version, s.run_id, s.generated_at,
         NOT EXISTS (SELECT 1 FROM step_variants v WHERE v.step_id = s.id) AS used_base
  FROM library_steps s
  JOIN library_lessons l ON l.id = s.lesson_id
  JOIN skills k ON k.id = s.skill_id AND k.owner_id IS NULL
  WHERE s.kind = 'check'
    AND s.retired_at IS NULL AND NOT s.staged AND s.item_id IS NULL
    AND l.owner_id IS NULL AND l.content_status = 'completed' AND l.set_aside_at IS NULL
    AND NOT (s.content ? 'image') AND s.media_asset_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(s.content->'options') o WHERE o ? 'picture'
    )
    AND NOT EXISTS (SELECT 1 FROM library_step_option_pictures p WHERE p.step_id = s.id)
    AND s.id NOT IN ('01a1c150-2207-77e0-97bc-47ad3a4d495a', '01a1d12d-23cc-7d06-af2c-346546b2388d')
),
options AS (
  SELECT c.step_id, o.value, o.position, label[1] AS prefix, coalesce(label[2], label[3]) AS letter
  FROM checks c
  CROSS JOIN LATERAL jsonb_array_elements(c.content->'options') WITH ORDINALITY AS o(value, position)
  LEFT JOIN LATERAL regexp_match(o.value->>'text', '^([[:space:]]*(?:\(([a-e])\)|([a-e])[).])[[:space:]]+)', 'i') AS label ON true
),
label_sets AS (
  SELECT step_id
  FROM options
  GROUP BY step_id
  HAVING string_agg(lower(letter), '' ORDER BY lower(letter)) = left('abcde', count(*)::int)
    AND count(letter) = count(*)
    AND count(DISTINCT replace(btrim(prefix), letter, '')) = 1
    AND (bool_and(letter = upper(letter)) OR bool_and(letter = lower(letter)))
),
inserted AS (
  INSERT INTO items (id, skill_id, language, format, difficulty, content, model, prompt_version, run_id, generated_at)
  SELECT c.item_id, c.skill_id, c.language, 'multiple_choice', 0,
         jsonb_build_object(
           'context', c.content->'context',
           'question', c.content->'question',
           'visual', c.content->'visual',
           'image', NULL,
           'fixedOrder', false,
           'select', 1,
           'options', (
             SELECT jsonb_agg(jsonb_build_object(
               'text', CASE WHEN ls.step_id IS NULL THEN o.value->>'text'
                            ELSE substr(o.value->>'text', length(o.prefix) + 1) END,
               'isCorrect', o.value->'isCorrect',
               'reason', o.value->'reason',
               'misconception', NULL
             ) ORDER BY o.position)
             FROM options o WHERE o.step_id = c.step_id
           )
         ),
         c.model, c.prompt_version, c.run_id, c.generated_at
  FROM checks c
  LEFT JOIN label_sets ls ON ls.step_id = c.step_id
  RETURNING id
),
linked AS (
  UPDATE library_steps s SET item_id = c.item_id
  FROM checks c JOIN inserted i ON i.id = c.item_id
  WHERE s.id = c.step_id
  RETURNING s.id, s.item_id, c.used_base
),
linked_attempts AS (
  UPDATE attempts a SET item_id = l.item_id
  FROM linked l
  WHERE l.used_base AND a.step_id = l.id AND a.item_id IS NULL
)
UPDATE mistakes m SET item_id = l.item_id
FROM linked l
WHERE l.used_base AND m.step_id = l.id AND m.item_id IS NULL AND m.status = 'open';
