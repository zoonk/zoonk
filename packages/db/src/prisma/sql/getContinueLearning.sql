-- @param {Int} $1:userId
-- @param {Int} $2:limit
WITH last_per_course AS (
  SELECT DISTINCT ON (ch.course_id)
    ch.course_id,
    ap.completed_at,
    c.slug as course_slug,
    c.title as course_title,
    c.image_url as course_image_url,
    o.slug as org_slug,
    a.position as activity_position,
    a.lesson_id,
    l.position as lesson_position,
    l.chapter_id,
    ch.position as chapter_position
  FROM activity_progress ap
  JOIN activities a ON a.id = ap.activity_id AND a.is_published = true
  JOIN lessons l ON l.id = a.lesson_id AND l.is_published = true
  JOIN chapters ch ON ch.id = l.chapter_id AND ch.is_published = true
  JOIN courses c ON c.id = ch.course_id
  LEFT JOIN organizations o ON o.id = c.organization_id
  WHERE ap.user_id = $1 AND ap.completed_at IS NOT NULL AND (o.kind = 'brand' OR o.id IS NULL)
  ORDER BY ch.course_id, ap.completed_at DESC
)
SELECT
  lpc.course_id as "courseId",
  lpc.course_slug as "courseSlug",
  lpc.course_title as "courseTitle",
  lpc.course_image_url as "courseImageUrl",
  lpc.org_slug as "orgSlug",
  lpc.activity_position as "activityPosition",
  lpc.lesson_id as "lessonId",
  lpc.lesson_position as "lessonPosition",
  lpc.chapter_id as "chapterId",
  lpc.chapter_position as "chapterPosition"
FROM last_per_course lpc
ORDER BY lpc.completed_at DESC
LIMIT $2;
