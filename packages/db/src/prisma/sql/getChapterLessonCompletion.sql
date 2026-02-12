-- @param {Int} $1:userId
-- @param {Int} $2:chapterId
SELECT
  l.id AS "lessonId",
  COUNT(DISTINCT a.id)::int AS "totalActivities",
  COUNT(DISTINCT CASE WHEN ap.completed_at IS NOT NULL THEN a.id END)::int AS "completedActivities"
FROM lessons l
JOIN activities a ON a.lesson_id = l.id AND a.is_published = true
LEFT JOIN activity_progress ap ON ap.activity_id = a.id AND ap.user_id = $1
WHERE l.chapter_id = $2 AND l.is_published = true
GROUP BY l.id
ORDER BY l.position;
