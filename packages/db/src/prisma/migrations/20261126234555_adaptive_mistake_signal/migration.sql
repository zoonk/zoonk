-- CreateEnum
CREATE TYPE "AttemptEvidence" AS ENUM ('independent', 'guided', 'replay');

-- AlterEnum
ALTER TYPE "FollowUpKind" ADD VALUE 'write_second_take';

-- AlterTable
ALTER TABLE "attempts" ADD COLUMN     "cause" "MistakeCause",
ADD COLUMN     "evidence" "AttemptEvidence";

-- AlterTable
ALTER TABLE "learner_skills" ADD COLUMN     "helped_at" TIMESTAMP(3);

UPDATE attempts AS attempt
SET cause = mistake.cause
FROM mistakes AS mistake
WHERE mistake.attempt_id = attempt.id AND mistake.cause IS NOT NULL;

UPDATE attempts AS attempt
SET evidence = 'independent'
WHERE NOT attempt.is_placement
  AND attempt.focus_test_id IS NULL
  AND attempt.from_lesson IS NOT TRUE
  AND attempt.step_id IS NULL
  AND attempt.item_id IS NOT NULL
  AND attempt.skill_id IS NOT NULL
  AND attempt.answer <> '{}'::jsonb
  AND NOT (attempt.answer ?| ARRAY['dontKnow', 'practiceMistakeId', 'fixedMistakeIds'])
  AND COALESCE(attempt.answer->'number', '0'::jsonb) <> 'null'::jsonb
  AND (
    (attempt.mock_exam_id IS NULL AND attempt.study_session_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM study_session_blocks AS block
      WHERE block.session_id = attempt.study_session_id
        AND block.payload @> jsonb_build_object('drills',
          jsonb_build_array(jsonb_build_object('itemIds', jsonb_build_array(attempt.item_id))))
    ))
    OR EXISTS (
      SELECT 1 FROM mock_exams AS mock
      WHERE mock.id = attempt.mock_exam_id
        AND mock.status = 'finished'
        AND mock.finished_at IS NOT NULL
        AND mock.conditions->>'purpose' IN ('planned', 'practice')
    )
  );
