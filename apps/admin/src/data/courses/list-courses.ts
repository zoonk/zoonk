import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { type CourseGetPayload, prisma } from "@zoonk/db";

/**
 * A course's outline is a set of shared chapters placed through `CourseChapter`, and each chapter
 * holds shared lessons through `ChapterLesson`, so counts walk the join tables.
 */
const courseListInclude = {
  courseChapters: { select: { chapterId: true } },
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

  const writtenLessons = await countWrittenLessons(
    courses.flatMap((course) => course.courseChapters.map((placement) => placement.chapterId)),
  );

  return { courses: courses.map((course) => addOutlineCounts(course, writtenLessons)), total };
});

/**
 * Written lessons per chapter, counted for the page's chapters only: a relation `_count` would
 * count every chapter's lessons.
 */
async function countWrittenLessons(chapterIds: string[]): Promise<Map<string, number>> {
  const counts = await prisma.chapterLesson.groupBy({
    _count: { lessonId: true },
    by: ["chapterId"],
    where: { chapterId: { in: [...new Set(chapterIds)] }, lesson: { contentStatus: "completed" } },
  });

  return new Map(counts.map((row) => [row.chapterId, row._count.lessonId]));
}

export async function listCourses(params: { limit: number; offset: number; search?: string }) {
  return cachedListCourses(params.limit, params.offset, params.search);
}

/**
 * The course table needs one number per course, from one written lesson count per placed chapter.
 * A lesson shared by two chapters of the same course counts twice, which matches what learners
 * see in the outline.
 */
function addOutlineCounts(
  course: CourseWithOutline,
  writtenLessons: Map<string, number>,
): ListedCourse {
  const { courseChapters, ...courseFields } = course;

  const writtenLessonCount = courseChapters.reduce(
    (total, placement) => total + (writtenLessons.get(placement.chapterId) ?? 0),
    0,
  );

  return { ...courseFields, chapterCount: courseChapters.length, writtenLessonCount };
}
