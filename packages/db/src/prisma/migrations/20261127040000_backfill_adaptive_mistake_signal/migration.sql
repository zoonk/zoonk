UPDATE attempts AS attempt
SET cause = mistake.cause
FROM mistakes AS mistake
WHERE mistake.attempt_id = attempt.id AND mistake.cause IS NOT NULL;

WITH drill_questions AS MATERIALIZED (
  SELECT DISTINCT block.session_id, question.item_id
  FROM study_session_blocks AS block
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(block.payload->'drills') = 'array' THEN block.payload->'drills' ELSE '[]'::jsonb END
  ) AS drill(data)
  CROSS JOIN LATERAL jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(drill.data->'itemIds') = 'array' THEN drill.data->'itemIds' ELSE '[]'::jsonb END
  ) AS question(item_id)
  WHERE block.payload ? 'drills'
), notebook_questions AS (
  SELECT mistake.user_id, question.item_id,
    MIN(COALESCE(source.answered_at, mistake.created_at)) AS first_miss
  FROM mistakes AS mistake
  LEFT JOIN attempts AS source ON source.id = mistake.attempt_id
  CROSS JOIN LATERAL (VALUES (mistake.item_id::text), (mistake.snapshot #>> '{replay,item,id}')) AS question(item_id)
  WHERE question.item_id IS NOT NULL
  GROUP BY mistake.user_id, question.item_id
), independent AS (
  SELECT attempt.id
  FROM attempts AS attempt
  LEFT JOIN mock_exams AS mock ON mock.id = attempt.mock_exam_id
  LEFT JOIN drill_questions AS drill
    ON drill.session_id = attempt.study_session_id AND drill.item_id = attempt.item_id::text
  LEFT JOIN notebook_questions AS notebook
    ON notebook.user_id = attempt.user_id AND notebook.item_id = attempt.item_id::text
  WHERE NOT attempt.is_placement
    AND attempt.focus_test_id IS NULL
    AND attempt.from_lesson IS NOT TRUE
    AND attempt.step_id IS NULL
    AND attempt.item_id IS NOT NULL
    AND attempt.skill_id IS NOT NULL
    AND attempt.answer <> '{}'::jsonb
    AND NOT (attempt.answer ?| ARRAY['dontKnow', 'practiceMistakeId', 'fixedMistakeIds', 'mockMistakeId', 'mockReplay'])
    AND COALESCE(attempt.answer->'number', '0'::jsonb) <> 'null'::jsonb
    AND (notebook.first_miss IS NULL OR notebook.first_miss >= attempt.answered_at)
    AND (
      (attempt.mock_exam_id IS NULL AND attempt.study_session_id IS NOT NULL AND drill.session_id IS NULL)
      OR (mock.status = 'finished' AND mock.finished_at IS NOT NULL
        AND mock.conditions->>'purpose' IN ('planned', 'practice'))
    )
), attribution AS (
  SELECT id, 'independent'::"AttemptEvidence" AS evidence FROM independent
  UNION ALL
  SELECT id, 'replay'::"AttemptEvidence" FROM attempts
  WHERE study_session_id IS NULL
    AND jsonb_typeof(answer->'practiceMistakeId') = 'string'
    AND answer->'practiceCredit' IS DISTINCT FROM 'false'::jsonb
)
UPDATE attempts AS attempt
SET evidence = attribution.evidence
FROM attribution
WHERE attempt.id = attribution.id;
