-- Exam courses are listed under exams because of what they are, as language courses are under
-- languages (a language exam such as IELTS keeps both), instead of the subjects a model picked.
INSERT INTO "course_categories" ("course_id", "category")
SELECT DISTINCT "course_categories"."course_id", 'exams'
FROM "course_categories"
JOIN "courses" ON "courses"."id" = "course_categories"."course_id"
WHERE "courses"."format" = 'exam'
ON CONFLICT ("course_id", "category") DO NOTHING;

DELETE FROM "course_categories"
USING "courses"
WHERE "courses"."id" = "course_categories"."course_id"
  AND "courses"."format" = 'exam'
  AND "course_categories"."category" NOT IN ('exams', 'languages');
