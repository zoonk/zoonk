import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { getSession } from "../users/get-user-session";

/**
 * This query powers the chapter list progress on the course page.
 * We count every published lesson in a published chapter because the catalog
 * should only show a chapter as complete once every listed lesson is done.
 * A lesson with zero published activities is therefore still part of the total,
 * but it cannot count as completed yet.
 */
export async function getChapterProgress({
  courseId,
  headers,
}: {
  courseId: number;
  headers?: Headers;
}): Promise<
  {
    chapterId: number;
    completedLessons: number;
    totalLessons: number;
  }[]
> {
  const session = await getSession(headers);
  const userId = session ? Number(session.user.id) : 0;

  if (userId === 0) {
    return [];
  }

  const { data, error } = await safeAsync(
    () =>
      prisma.$queryRaw<
        {
          chapterId: number;
          totalLessons: number | null;
          completedLessons: number | null;
        }[]
      >`
      WITH lesson_status AS (
        SELECT
          l.id AS lesson_id,
          l.chapter_id,
          COUNT(DISTINCT a.id)::int AS total_activities,
          COUNT(DISTINCT CASE WHEN ap.completed_at IS NOT NULL THEN a.id END)::int AS completed_activities
        FROM lessons l
        JOIN chapters ch ON ch.id = l.chapter_id AND ch.course_id = ${courseId} AND ch.is_published = true AND ch.archived_at IS NULL
        LEFT JOIN activities a ON a.lesson_id = l.id AND a.is_published = true AND a.archived_at IS NULL
        LEFT JOIN activity_progress ap ON ap.activity_id = a.id AND ap.user_id = ${userId}
        WHERE l.is_published = true AND l.archived_at IS NULL
        GROUP BY l.id, l.chapter_id
      )
      SELECT
        ch.id AS "chapterId",
        COUNT(ls.lesson_id)::int AS "totalLessons",
        COUNT(CASE
          WHEN ls.total_activities > 0 AND ls.completed_activities = ls.total_activities THEN 1
        END)::int AS "completedLessons"
      FROM chapters ch
      LEFT JOIN lesson_status ls ON ls.chapter_id = ch.id
      WHERE ch.course_id = ${courseId} AND ch.is_published = true AND ch.archived_at IS NULL
      GROUP BY ch.id
      ORDER BY ch.position
    `,
  );

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    chapterId: row.chapterId,
    completedLessons: row.completedLessons ?? 0,
    totalLessons: row.totalLessons ?? 0,
  }));
}
