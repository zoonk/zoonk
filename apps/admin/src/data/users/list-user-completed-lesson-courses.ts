import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";

type CompletedLessonCourseRow = {
  completedLessonCount: bigint;
  courseId: string;
  courseTitle: string | null;
  lastCompletedAt: Date;
};

export type UserCompletedLessonCourse = {
  completedLessonCount: number;
  course: { id: string; title: string | null };
  lastCompletedAt: Date;
};

const cachedListUserCompletedLessonCourses = cacheAdminData(async (userId: string) => {
  if (!isUuid(userId)) {
    return [];
  }

  const rows = await findUserCompletedLessonCourseRows({ userId });

  return rows.map((row) => serializeCompletedLessonCourse({ row }));
});

/**
 * The detail page passes route params through a cached primitive value so
 * repeated sections can reuse the same database read without object identity
 * breaking React's cache lookup.
 */
export async function listUserCompletedLessonCourses(params: { userId: string }) {
  return cachedListUserCompletedLessonCourses(params.userId);
}

/**
 * The UI needs one row per course, not one row per completed lesson. Finished
 * lesson rows in the learning ledger keep the course id without a foreign key,
 * so the counts survive the course being deleted; the current course title is
 * only looked up for display and is null once the course is gone.
 */
function findUserCompletedLessonCourseRows({ userId }: { userId: string }) {
  return prisma.$queryRaw<CompletedLessonCourseRow[]>`
    WITH completed_lesson_courses AS (
      SELECT
        learning_events.content_ids->>'courseId' AS "courseId",
        COUNT(*)::bigint AS "completedLessonCount",
        MAX(learning_events.ended_at) AS "lastCompletedAt"
      FROM learning_events
      WHERE
        learning_events.user_id = ${userId}::uuid
        AND learning_events.kind = 'lesson'
        AND learning_events.ended_at IS NOT NULL
        AND learning_events.content_ids ? 'courseId'
      GROUP BY learning_events.content_ids->>'courseId'
    )
    SELECT
      completed_lesson_courses."courseId",
      courses.title AS "courseTitle",
      completed_lesson_courses."completedLessonCount",
      completed_lesson_courses."lastCompletedAt"
    FROM completed_lesson_courses
    LEFT JOIN courses ON courses.id::text = completed_lesson_courses."courseId"
    ORDER BY
      completed_lesson_courses."lastCompletedAt" DESC,
      completed_lesson_courses."courseId" ASC
  `;
}

/**
 * Raw SQL returns bigint counts and flat aliases. Converting those at the data
 * boundary keeps the table component focused on display instead of database
 * numeric types or join aliases.
 */
function serializeCompletedLessonCourse({
  row,
}: {
  row: CompletedLessonCourseRow;
}): UserCompletedLessonCourse {
  return {
    completedLessonCount: Number(row.completedLessonCount),
    course: { id: row.courseId, title: row.courseTitle },
    lastCompletedAt: row.lastCompletedAt,
  };
}
