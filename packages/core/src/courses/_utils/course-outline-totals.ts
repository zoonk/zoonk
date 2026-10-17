import "server-only";
import { prisma } from "@zoonk/db";

type CourseOutlineTotals = { estimatedMinutes: number; lessonCount: number };

const NO_LESSONS: CourseOutlineTotals = { estimatedMinutes: 0, lessonCount: 0 };

/** Only shared chapters and lessons count: the catalog is cached for every viewer. */
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

/**
 * Adds to each course the lessons its outline places and their estimated minutes added up, the
 * numbers its page states ("37 short lessons · about 2 hr"), for a whole catalog page in one
 * grouped query. An outline whose lessons aren't written yet has none.
 */
export async function withOutlineTotals<Course extends { id: string }>(
  courses: Course[],
): Promise<(Course & CourseOutlineTotals)[]> {
  if (courses.length === 0) {
    return [];
  }

  const totals = await findOutlineTotals(courses.map((course) => course.id));
  return courses.map((course) => ({ ...course, ...(totals.get(course.id) ?? NO_LESSONS) }));
}
