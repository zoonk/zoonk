-- Language levels from the skill estimator are no longer certificates.
DELETE FROM "certificates" WHERE "kind" = 'language_level';

-- A level or plan certificate needs at least half of its lessons studied on Zoonk.
DELETE FROM "certificates"
WHERE "kind" = 'course'
  AND ("details"->>'lessonsStudied')::int * 2
    < ("details"->>'lessonsStudied')::int + ("details"->>'lessonsTestedOut')::int;
