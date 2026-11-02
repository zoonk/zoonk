import "server-only";
import { type GoalKind, prisma } from "@zoonk/db";
import { type PlanCourseView } from "../../../plans/plan-course-contract";
import { type StudyNextView } from "../map-contract";

type MapCourse = { brandSlug: string | null; courseId: string; courseSlug: string; title: string };

/** Preserves plan order, excludes other learners' private courses, and omits public-page branding for private courses. */
export async function loadMapCourses({
  courseIds,
  userId,
}: {
  courseIds: readonly string[];
  userId: string;
}): Promise<MapCourse[]> {
  const rows = await prisma.course.findMany({
    select: {
      id: true,
      organization: { select: { slug: true } },
      slug: true,
      title: true,
      visibility: true,
    },
    where: { OR: [{ visibility: "public" }, { userId }], id: { in: [...courseIds] } },
  });

  return courseIds.flatMap((courseId) => {
    const row = rows.find((course) => course.id === courseId);

    if (!row) {
      return [];
    }

    return [
      {
        brandSlug: row.visibility === "public" ? (row.organization?.slug ?? null) : null,
        courseId: row.id,
        courseSlug: row.slug,
        title: row.title,
      },
    ];
  });
}

/** Only completed learn plans climb course levels; related suggestions must have public pages. */
export function buildStudyNext({
  course,
  courses,
  goalKind,
}: {
  course: PlanCourseView | null;
  courses: readonly MapCourse[];
  goalKind: GoalKind;
}): StudyNextView {
  // Only learn goals climb a course's levels; exams and languages have their own ladders.
  const level = goalKind === "learn" ? (course?.nextLevel ?? null) : null;

  const related = courses.flatMap(({ brandSlug, courseId, courseSlug, title }) =>
    brandSlug && courseId !== course?.courseId ? [{ brandSlug, courseId, courseSlug, title }] : [],
  );

  return {
    nextLevel:
      course && level
        ? {
            chapterCount:
              course.levels.find((candidate) => candidate.level === level)?.chapterCount ?? 0,
            courseId: course.courseId,
            level,
            title: course.title,
          }
        : null,
    related,
  };
}
