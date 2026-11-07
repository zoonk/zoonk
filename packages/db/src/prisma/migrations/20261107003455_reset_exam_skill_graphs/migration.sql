-- An owner-approved, one-time reset: each exam's next learner writes its skill graph again with
-- the current rules, reusing the skills other exams already use in its courses. As in the admin's
-- reset of one exam, a plan keeps its own copy of its graph and its learner's mastery, and is only
-- marked stale so its days are laid out again. Skills, courses, chapters and lessons stay. A graph
-- the previous deployment saves after this runs is kept; resetting that exam in admin clears it.
UPDATE "plans"
SET "source_version" = "source_version" + 1
WHERE "goal_id" IN (
  SELECT "goal"."id"
  FROM "goals" AS "goal"
  JOIN "exam_skill_graphs" AS "graph" ON "graph"."exam_blueprint_id" = "goal"."exam_blueprint_id"
);

DELETE FROM "exam_skill_graphs";
