import { type Sql, sql } from "@zoonk/db";

/**
 * The v2 Library, one row per type and day: courses with an outline (`course_chapters`), chapters
 * whose lesson outline is written, lessons whose content is generated, and every step, skill
 * (merged duplicates left out), item, image, audio file, source and exam blueprint. Lesson
 * outlines exist before their content, so a lesson counts by its creation date once generated.
 */
export function getLibraryContentCreatedSql({ end, start }: { end: Date; start: Date }): Sql {
  return sql`
    SELECT DATE(courses.created_at) AS date, 'courses' AS type, COUNT(*) AS count
    FROM courses
    WHERE
      courses.created_at >= ${start}
      AND courses.created_at <= ${end}
      AND EXISTS (SELECT 1 FROM course_chapters WHERE course_chapters.course_id = courses.id)
    GROUP BY DATE(courses.created_at)

    UNION ALL

    SELECT DATE(created_at) AS date, 'chapters' AS type, COUNT(*) AS count
    FROM library_chapters
    WHERE created_at >= ${start} AND created_at <= ${end} AND outline_status = 'completed'
    GROUP BY DATE(created_at)

    UNION ALL

    SELECT DATE(created_at) AS date, 'lessons' AS type, COUNT(*) AS count
    FROM library_lessons
    WHERE created_at >= ${start} AND created_at <= ${end} AND content_status = 'completed'
    GROUP BY DATE(created_at)

    UNION ALL

    SELECT DATE(created_at) AS date, 'steps' AS type, COUNT(*) AS count
    FROM library_steps
    WHERE created_at >= ${start} AND created_at <= ${end}
    GROUP BY DATE(created_at)

    UNION ALL

    SELECT DATE(created_at) AS date, 'skills' AS type, COUNT(*) AS count
    FROM skills
    WHERE created_at >= ${start} AND created_at <= ${end} AND merged_into_id IS NULL
    GROUP BY DATE(created_at)

    UNION ALL

    SELECT DATE(created_at) AS date, 'items' AS type, COUNT(*) AS count
    FROM items
    WHERE created_at >= ${start} AND created_at <= ${end}
    GROUP BY DATE(created_at)

    UNION ALL

    SELECT DATE(created_at) AS date, CASE WHEN kind = 'image' THEN 'images' ELSE 'audio' END AS type, COUNT(*) AS count
    FROM media_assets
    WHERE created_at >= ${start} AND created_at <= ${end}
    GROUP BY DATE(created_at), kind

    UNION ALL

    SELECT DATE(created_at) AS date, 'sources' AS type, COUNT(*) AS count
    FROM sources
    WHERE created_at >= ${start} AND created_at <= ${end}
    GROUP BY DATE(created_at)

    UNION ALL

    SELECT DATE(created_at) AS date, 'examBlueprints' AS type, COUNT(*) AS count
    FROM exam_blueprints
    WHERE created_at >= ${start} AND created_at <= ${end}
    GROUP BY DATE(created_at)
  `;
}
