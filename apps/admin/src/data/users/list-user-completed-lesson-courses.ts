import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";

type CompletedLessonCourseRow = {
  completedChapterCount: bigint | null;
  completedLessonCount: bigint;
  courseId: string;
  courseTitle: string;
  lastCompletedAt: Date;
};

export type UserCompletedLessonCourse = {
  completedChapterCount: number;
  completedLessonCount: number;
  course: { id: string; title: string };
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
 * The UI needs one row per course, not one row per completed lesson. Grouping
 * in SQL keeps the query proportional to the number of courses shown while
 * completion rows stay the source of truth for learner progress.
 */
function findUserCompletedLessonCourseRows({ userId }: { userId: string }) {
  return prisma.$queryRaw<CompletedLessonCourseRow[]>`
    WITH completed_lesson_courses AS (
      SELECT
        courses.id AS "courseId",
        courses.title AS "courseTitle",
        COUNT(*)::bigint AS "completedLessonCount",
        MAX(lesson_progress.completed_at) AS "lastCompletedAt"
      FROM lesson_progress
      JOIN lessons ON lessons.id = lesson_progress.lesson_id
      JOIN chapters ON chapters.id = lessons.chapter_id
      JOIN courses ON courses.id = chapters.course_id
      WHERE
        lesson_progress.user_id = ${userId}::uuid
        AND lesson_progress.completed_at IS NOT NULL
      GROUP BY courses.id, courses.title
    ),
    completed_chapter_courses AS (
      SELECT
        chapters.course_id AS "courseId",
        COUNT(*)::bigint AS "completedChapterCount"
      FROM chapter_completions
      JOIN chapters ON chapters.id = chapter_completions.chapter_id
      JOIN completed_lesson_courses ON completed_lesson_courses."courseId" = chapters.course_id
      WHERE
        chapter_completions.user_id = ${userId}::uuid
      GROUP BY chapters.course_id
    )
    SELECT
      completed_lesson_courses."courseId",
      completed_lesson_courses."courseTitle",
      completed_lesson_courses."completedLessonCount",
      completed_lesson_courses."lastCompletedAt",
      completed_chapter_courses."completedChapterCount"
    FROM completed_lesson_courses
    LEFT JOIN completed_chapter_courses
      ON completed_chapter_courses."courseId" = completed_lesson_courses."courseId"
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
    completedChapterCount: Number(row.completedChapterCount ?? 0n),
    completedLessonCount: Number(row.completedLessonCount),
    course: { id: row.courseId, title: row.courseTitle },
    lastCompletedAt: row.lastCompletedAt,
  };
}
