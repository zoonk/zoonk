-- @param {Int} $1:userId
-- @param {Int} $2:limit
WITH first_incomplete AS (
  SELECT DISTINCT ON (cu.course_id)
    cu.course_id,
    cu.started_at,
    c.slug as course_slug,
    c.title as course_title,
    c.image_url as course_image_url,
    o.slug as org_slug,
    ch.id as chapter_id,
    ch.slug as chapter_slug,
    l.id as lesson_id,
    l.slug as lesson_slug,
    l.title as lesson_title,
    l.description as lesson_description,
    a.id as activity_id,
    a.kind as activity_kind,
    a.title as activity_title,
    a.position as activity_position
  FROM course_users cu
  JOIN courses c ON c.id = cu.course_id
  JOIN organizations o ON o.id = c.organization_id
  JOIN chapters ch ON ch.course_id = c.id AND ch.is_published = true
  JOIN lessons l ON l.chapter_id = ch.id AND l.is_published = true
  JOIN activities a ON a.lesson_id = l.id AND a.is_published = true
  LEFT JOIN activity_progress ap ON ap.activity_id = a.id AND ap.user_id = $1
  WHERE cu.user_id = $1
    AND (ap.completed_at IS NULL OR ap.id IS NULL)
  ORDER BY
    cu.course_id,
    ch.position ASC,
    l.position ASC,
    a.position ASC
)
SELECT
  fi.course_id as "courseId",
  fi.course_slug as "courseSlug",
  fi.course_title as "courseTitle",
  fi.course_image_url as "courseImageUrl",
  fi.org_slug as "orgSlug",
  fi.chapter_id as "chapterId",
  fi.chapter_slug as "chapterSlug",
  fi.lesson_id as "lessonId",
  fi.lesson_slug as "lessonSlug",
  fi.lesson_title as "lessonTitle",
  fi.lesson_description as "lessonDescription",
  fi.activity_id as "activityId",
  fi.activity_kind as "activityKind",
  fi.activity_title as "activityTitle",
  fi.activity_position as "activityPosition"
FROM first_incomplete fi
ORDER BY fi.started_at DESC
LIMIT $2;
