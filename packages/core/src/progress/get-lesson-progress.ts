import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { getSession } from "../users/get-user-session";

export async function getLessonProgress({
  chapterId,
  headers,
}: {
  chapterId: number;
  headers?: Headers;
}): Promise<
  {
    completedActivities: number;
    lessonId: number;
    totalActivities: number;
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
          lessonId: number;
          totalActivities: number | null;
          completedActivities: number | null;
        }[]
      >`
      SELECT
        l.id AS "lessonId",
        COUNT(DISTINCT a.id)::int AS "totalActivities",
        COUNT(DISTINCT CASE WHEN ap.completed_at IS NOT NULL THEN a.id END)::int AS "completedActivities"
      FROM lessons l
      JOIN activities a ON a.lesson_id = l.id AND a.is_published = true
      LEFT JOIN activity_progress ap ON ap.activity_id = a.id AND ap.user_id = ${userId}
      WHERE l.chapter_id = ${chapterId} AND l.is_published = true
      GROUP BY l.id
      ORDER BY l.position
    `,
  );

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    completedActivities: row.completedActivities ?? 0,
    lessonId: row.lessonId,
    totalActivities: row.totalActivities ?? 0,
  }));
}
