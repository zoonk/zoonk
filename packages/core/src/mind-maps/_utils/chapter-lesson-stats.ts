import "server-only";
import { type Sql, sql } from "@zoonk/db";

/**
 * One row for the chapter's library lessons: their ids, how many are still to write (a set-aside
 * lesson never will be) and whether any is written. A map draws from every written one.
 */
export function chapterLessonStats(chapterId: Sql): Sql {
  return sql`
    SELECT
      coalesce(array_agg(cl.lesson_id), '{}') AS lesson_ids,
      (count(*) FILTER (WHERE l.content_status <> 'completed' AND l.set_aside_at IS NULL))::int
        AS to_write,
      coalesce(bool_or(l.content_status = 'completed'), false) AS written
    FROM chapter_lessons cl
    JOIN library_lessons l ON l.id = cl.lesson_id
    WHERE cl.chapter_id = ${chapterId}`;
}
