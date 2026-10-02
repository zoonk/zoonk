import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { type CourseGetPayload, prisma } from "@zoonk/db";

/**
 * A course's outline is a set of shared chapters placed through `CourseChapter`, and each chapter
 * holds shared lessons through `ChapterLesson`, so counts walk the join tables.
 */
const courseListInclude = {
  courseChapters: {
    select: {
      chapter: {
        select: {
          _count: { select: { lessons: { where: { lesson: { contentStatus: "completed" } } } } },
        },
      },
    },
  },
  organization: true,
} as const;

type CourseWithOutline = CourseGetPayload<{ include: typeof courseListInclude }>;

export type ListedCourse = Omit<CourseWithOutline, "courseChapters"> & {
  chapterCount: number;
  writtenLessonCount: number;
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

  return { courses: courses.map((course) => addOutlineCounts(course)), total };
});

export async function listCourses(params: { limit: number; offset: number; search?: string }) {
  return cachedListCourses(params.limit, params.offset, params.search);
}

/**
 * The course table needs one number per course, while Prisma returns one filtered lesson count
 * per placed chapter. A lesson shared by two chapters of the same course counts twice, which
 * matches what learners see in the outline.
 */
function addOutlineCounts(course: CourseWithOutline): ListedCourse {
  const { courseChapters, ...courseFields } = course;

  const writtenLessonCount = courseChapters.reduce(
    (total, placement) => total + placement.chapter._count.lessons,
    0,
  );

  return { ...courseFields, chapterCount: courseChapters.length, writtenLessonCount };
}
