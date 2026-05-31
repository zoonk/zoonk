import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { type CourseGetPayload, prisma } from "@zoonk/db";

const courseListInclude = {
  chapters: {
    select: {
      _count: { select: { lessons: { where: { generationStatus: "completed" as const } } } },
    },
  },
  organization: true,
} as const;

type CourseWithCompletedLessonChapters = CourseGetPayload<{ include: typeof courseListInclude }>;
export type ListedCourse = Omit<CourseWithCompletedLessonChapters, "chapters"> & {
  completedLessonCount: number;
};

const cachedListCourses = cacheAdminData(async (limit: number, offset: number, search?: string) => {
  const where = search
    ? { normalizedTitle: { contains: search, mode: "insensitive" as const } }
    : undefined;

  const [courses, total] = await Promise.all([
    prisma.course.findMany({
      include: courseListInclude,
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
      where,
    }),
    prisma.course.count({ where }),
  ]);

  return { courses: courses.map((course) => addCompletedLessonCount(course)), total };
});

export async function listCourses(params: { limit: number; offset: number; search?: string }) {
  return cachedListCourses(params.limit, params.offset, params.search);
}

/**
 * The course table needs one number per course, while Prisma returns one
 * filtered lesson count per chapter. Summing here keeps the rendering code from
 * knowing how lessons are nested under courses.
 */
function addCompletedLessonCount(course: CourseWithCompletedLessonChapters): ListedCourse {
  const { chapters, ...courseFields } = course;

  const completedLessonCount = chapters.reduce(
    (total, chapter) => total + chapter._count.lessons,
    0,
  );

  return { ...courseFields, completedLessonCount };
}
