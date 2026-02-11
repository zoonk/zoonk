-- @param {Int} $1:userId
-- @param {Int} $2:courseId
SELECT o.slug AS "orgSlug", c.slug AS "courseSlug",
       ch.slug AS "chapterSlug", l.slug AS "lessonSlug",
       a.position AS "activityPosition",
       EXISTS(SELECT 1 FROM course_users WHERE course_id = $2 AND user_id = $1) AS "hasStarted"
FROM activities a
JOIN lessons l ON l.id = a.lesson_id
JOIN chapters ch ON ch.id = l.chapter_id
JOIN courses c ON c.id = ch.course_id
JOIN organizations o ON o.id = c.organization_id
LEFT JOIN activity_progress ap ON ap.activity_id = a.id AND ap.user_id = $1
WHERE ch.course_id = $2
  AND a.is_published = true AND l.is_published = true AND ch.is_published = true
  AND (ap.completed_at IS NULL OR ap.id IS NULL)
ORDER BY ch.position, l.position, a.position
LIMIT 1;
