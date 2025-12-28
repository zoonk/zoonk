import { prisma } from "@zoonk/db";
import {
  cacheTagChapter,
  cacheTagCourse,
  cacheTagLesson,
} from "@zoonk/utils/cache";

/**
 * Get all cache tags that need to be revalidated when a chapter changes.
 * This includes the chapter itself and all courses that contain it.
 */
export async function getChapterCacheTags(
  chapterId: number,
): Promise<string[]> {
  const courseChapters = await prisma.courseChapter.findMany({
    select: { courseId: true },
    where: { chapterId },
  });

  const courseTags = courseChapters.map((cc) =>
    cacheTagCourse({ courseId: cc.courseId }),
  );

  return [cacheTagChapter({ chapterId }), ...courseTags];
}

/**
 * Get all cache tags that need to be revalidated when a lesson changes.
 * This includes the lesson itself, all chapters that contain it,
 * and all courses that contain those chapters.
 */
export async function getLessonCacheTags(lessonId: number): Promise<string[]> {
  const chapterLessons = await prisma.chapterLesson.findMany({
    select: {
      chapter: {
        select: {
          courseChapters: {
            select: { courseId: true },
          },
        },
      },
      chapterId: true,
    },
    where: { lessonId },
  });

  const chapterTags = chapterLessons.map((cl) =>
    cacheTagChapter({ chapterId: cl.chapterId }),
  );

  const courseTags = chapterLessons.flatMap((cl) =>
    cl.chapter.courseChapters.map((cc) =>
      cacheTagCourse({ courseId: cc.courseId }),
    ),
  );

  return [cacheTagLesson({ lessonId }), ...chapterTags, ...courseTags];
}
