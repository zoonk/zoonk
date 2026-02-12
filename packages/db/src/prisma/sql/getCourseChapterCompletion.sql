-- @param {Int} $1:userId
-- @param {Int} $2:courseId
WITH lesson_status AS (
  SELECT
    l.id AS lesson_id,
    l.chapter_id,
    COUNT(a.id)::int AS total_activities,
    COUNT(CASE WHEN ap.completed_at IS NOT NULL THEN 1 END)::int AS completed_activities
  FROM lessons l
  JOIN chapters ch ON ch.id = l.chapter_id AND ch.course_id = $2 AND ch.is_published = true
  JOIN activities a ON a.lesson_id = l.id AND a.is_published = true
  LEFT JOIN activity_progress ap ON ap.activity_id = a.id AND ap.user_id = $1
  WHERE l.is_published = true
  GROUP BY l.id, l.chapter_id
)
SELECT
  ch.id AS "chapterId",
  COUNT(ls.lesson_id)::int AS "totalLessons",
  COUNT(CASE
    WHEN ls.completed_activities = ls.total_activities THEN 1
  END)::int AS "completedLessons"
FROM chapters ch
LEFT JOIN lesson_status ls ON ls.chapter_id = ch.id
WHERE ch.course_id = $2 AND ch.is_published = true
GROUP BY ch.id
ORDER BY ch.position;
