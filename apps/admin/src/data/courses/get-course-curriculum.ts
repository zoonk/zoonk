import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";

/**
 * How many courses use each chapter and how many chapters use each lesson, counted for these
 * chapters and lessons only: a relation `_count` would count every chapter's and lesson's places.
 */
async function countPlaces({
  chapterIds,
  lessonIds,
}: {
  chapterIds: string[];
  lessonIds: string[];
}) {
  const [chapterPlaces, lessonPlaces] = await Promise.all([
    prisma.courseChapter.groupBy({
      _count: { courseId: true },
      by: ["chapterId"],
      where: { chapterId: { in: chapterIds } },
    }),
    prisma.chapterLesson.groupBy({
      _count: { chapterId: true },
      by: ["lessonId"],
      where: { lessonId: { in: lessonIds } },
    }),
  ]);

  return {
    chaptersByLesson: new Map(lessonPlaces.map((row) => [row.lessonId, row._count.chapterId])),
    coursesByChapter: new Map(chapterPlaces.map((row) => [row.chapterId, row._count.courseId])),
  };
}

/**
 * A course's outline as learners see it: its chapters in level bands and order, each with its
 * lessons, plus what's needed to mark shared chapters and lessons (their home and how many
 * places use them).
 */
export const getCourseCurriculum = cacheAdminData(async (courseId: string) => {
  const placements = await prisma.courseChapter.findMany({
    include: {
      chapter: {
        select: {
          homeCourse: { select: { id: true, title: true } },
          id: true,
          lessons: {
            orderBy: { position: "asc" },
            select: {
              lesson: {
                select: { contentStatus: true, homeChapterId: true, id: true, title: true },
              },
              position: true,
            },
          },
          outlineStatus: true,
          title: true,
          visibility: true,
        },
      },
    },
    orderBy: [{ level: "asc" }, { position: "asc" }],
    where: { courseId },
  });

  const { chaptersByLesson, coursesByChapter } = await countPlaces({
    chapterIds: placements.map((placement) => placement.chapter.id),
    lessonIds: [
      ...new Set(
        placements.flatMap((placement) => placement.chapter.lessons.map((row) => row.lesson.id)),
      ),
    ],
  });

  return placements.map((placement) => ({
    ...placement,
    chapter: {
      ...placement.chapter,
      _count: { courses: coursesByChapter.get(placement.chapter.id) ?? 0 },
      lessons: placement.chapter.lessons.map((row) => ({
        ...row,
        lesson: { ...row.lesson, _count: { chapters: chaptersByLesson.get(row.lesson.id) ?? 0 } },
      })),
    },
  }));
});

export type CourseCurriculumChapter = Awaited<ReturnType<typeof getCourseCurriculum>>[number];
