-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "country" VARCHAR(2);

-- AlterTable
ALTER TABLE "goals" ADD COLUMN     "content_country" VARCHAR(2);

-- AlterTable
ALTER TABLE "skills" ADD COLUMN     "country" VARCHAR(2);

-- AlterTable
ALTER TABLE "user_learning_profiles" ADD COLUMN     "home_country" VARCHAR(2);

WITH linked_courses AS (
  SELECT e.country, g.primary_course_id::text AS course_id
  FROM exam_skill_graphs g JOIN exam_blueprints e ON e.id = g.exam_blueprint_id
  WHERE g.primary_course_id IS NOT NULL
  UNION
  SELECT e.country, g.graph->'courseOutline'->>'courseId'
  FROM exam_skill_graphs g JOIN exam_blueprints e ON e.id = g.exam_blueprint_id
  WHERE g.graph->'courseOutline'->>'courseId' IS NOT NULL
  UNION
  SELECT e.country, course_id
  FROM exam_skill_graphs g JOIN exam_blueprints e ON e.id = g.exam_blueprint_id
  CROSS JOIN LATERAL jsonb_array_elements(
    COALESCE(g.graph->'skills', '[]'::jsonb) || COALESCE(g.graph->'optionSkills', '[]'::jsonb)
  ) skill
  CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(skill->'courseIds', '[]'::jsonb)) course_id
), agreed AS (
  SELECT course_id, min(country) AS country
  FROM linked_courses
  GROUP BY course_id
  HAVING count(DISTINCT country) = 1
)
UPDATE courses c SET country = a.country
FROM agreed a
WHERE c.id::text = a.course_id
  AND a.country <> 'ZZ'
  AND a.country IS DISTINCT FROM CASE split_part(c.language, '-', 1)
    WHEN 'pt' THEN 'BR' WHEN 'es' THEN 'MX' WHEN 'en' THEN 'US'
    WHEN 'de' THEN 'DE' WHEN 'fr' THEN 'FR' WHEN 'it' THEN 'IT'
    WHEN 'ja' THEN 'JP' WHEN 'ko' THEN 'KR' WHEN 'pl' THEN 'PL' WHEN 'tr' THEN 'TR'
  END;

WITH skill_courses AS (
  SELECT cs.skill_id, c.country
  FROM chapter_skills cs
  JOIN library_chapters ch ON ch.id = cs.chapter_id
  JOIN courses c ON c.id = ch.home_course_id
  UNION
  SELECT cs.skill_id, c.country
  FROM chapter_skills cs
  JOIN course_chapters cc ON cc.chapter_id = cs.chapter_id
  JOIN courses c ON c.id = cc.course_id
), agreed AS (
  SELECT skill_id, min(country) AS country
  FROM skill_courses
  GROUP BY skill_id
  HAVING count(DISTINCT country) = 1 AND bool_and(country IS NOT NULL)
)
UPDATE skills s SET country = a.country
FROM agreed a WHERE s.id = a.skill_id;

UPDATE exam_blueprints
SET identity_key = CASE
  WHEN identity_key LIKE 'private:%' THEN
    substring(identity_key FROM '^(private:[^:]+:)') || country || ':' ||
    regexp_replace(identity_key, '^private:[^:]+:', '')
  ELSE country || ':' || identity_key
END;
