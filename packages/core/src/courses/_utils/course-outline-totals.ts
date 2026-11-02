import "server-only";
import { prisma } from "@zoonk/db";

type CourseOutlineTotals = { estimatedMinutes: number; lessonCount: number };

const NO_LESSONS: CourseOutlineTotals = { estimatedMinutes: 0, lessonCount: 0 };

/** Shared catalog caches must never count private content. */
async function findOutlineTotals(courseIds: string[]) {
  const rows = await prisma.$queryRaw<(CourseOutlineTotals & { courseId: string })[]>`
    SELECT
      cc.course_id AS "courseId",
      count(*)::int AS "lessonCount",
      coalesce(sum(l.estimated_minutes), 0)::int AS "estimatedMinutes"
    FROM course_chapters cc
    JOIN library_chapters ch ON ch.id = cc.chapter_id AND ch.visibility = 'public'
    JOIN chapter_lessons cl ON cl.chapter_id = cc.chapter_id
    JOIN library_lessons l ON l.id = cl.lesson_id AND l.visibility = 'public'
    WHERE cc.course_id = ANY(${courseIds}::uuid[])
    GROUP BY cc.course_id`;

  return new Map(rows.map(({ courseId, ...totals }) => [courseId, totals]));
}

/** Unwritten outlines contribute zero lessons and minutes. */
export async function withOutlineTotals<Course extends { id: string }>(
  courses: Course[],
): Promise<(Course & CourseOutlineTotals)[]> {
  if (courses.length === 0) {
    return [];
  }

  const totals = await findOutlineTotals(courses.map((course) => course.id));
  return courses.map((course) => ({ ...course, ...(totals.get(course.id) ?? NO_LESSONS) }));
}
