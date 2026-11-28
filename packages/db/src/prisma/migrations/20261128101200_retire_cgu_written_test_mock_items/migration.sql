-- Concurso CGU's mock supply wrote true/false questions for the skills its plans file under the
-- written test ("Prova discursiva"), which is graded essays. No objective paper asks those skills,
-- so no mock will seat these questions, and practice never reads mock-only ones.
UPDATE "items"
SET "retired_at" = CURRENT_TIMESTAMP
WHERE "retired_at" IS NULL
  AND "mock_only"
  AND "exam_blueprint_id" = '01a1bbff-f8a2-78a6-bb4b-a478ee4998fe'
  AND "skill_id" IN (
    '01a1bbfc-e9a6-7663-8953-74201e6d54f0',
    '01a1bbfc-eb73-7eed-8207-000af2e7f5f8',
    '01a1bbfc-eb74-7556-a032-2b7b39c7b407',
    '01a1bbfc-eb7c-7759-a6f4-d22d4b4832ad',
    '01a1bbfc-eb7c-7c6c-befc-196d4ba0e4e4',
    '01a1bbfd-04c4-7646-bd48-ee2f936fde42',
    '01a1bbfd-04c4-7bf4-a440-9fd5837f4fa5',
    '01a1bbfd-04c5-7321-83ec-50c32eaa3235',
    '01a1fa6b-94c8-74cc-900f-198f39e78790'
  );
