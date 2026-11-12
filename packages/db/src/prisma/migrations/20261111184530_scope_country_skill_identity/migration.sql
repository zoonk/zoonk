WITH skill_courses AS (
  SELECT cs.skill_id::text, c.country
  FROM chapter_skills cs
  JOIN library_chapters ch ON ch.id = cs.chapter_id
  JOIN courses c ON c.id = ch.home_course_id
  UNION
  SELECT cs.skill_id::text, c.country
  FROM chapter_skills cs
  JOIN course_chapters cc ON cc.chapter_id = cs.chapter_id
  JOIN courses c ON c.id = cc.course_id
  UNION
  SELECT skill->>'skillId', c.country
  FROM exam_skill_graphs g
  CROSS JOIN LATERAL jsonb_array_elements(
    COALESCE(g.graph->'skills', '[]'::jsonb) || COALESCE(g.graph->'optionSkills', '[]'::jsonb)
  ) skill
  CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(skill->'courseIds', '[]'::jsonb)) course_id
  JOIN courses c ON c.id::text = course_id
), agreed AS (
  SELECT skill_id,
    CASE WHEN count(DISTINCT country) = 1 AND bool_and(country IS NOT NULL)
      THEN min(country) ELSE NULL END AS country
  FROM skill_courses
  GROUP BY skill_id
)
UPDATE skills s SET country = a.country FROM agreed a WHERE s.id::text = a.skill_id;

UPDATE skills
SET identity_key = CASE
  WHEN identity_key LIKE 'private:%' THEN
    substring(identity_key FROM '^(private:[^:]+:)') || country || ':' ||
    regexp_replace(identity_key, '^private:[^:]+:', '')
  ELSE country || ':' || identity_key
END
WHERE country IS NOT NULL;
