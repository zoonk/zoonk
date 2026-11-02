import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { cacheTag } from "next/cache";
import {
  getCourseCacheTag,
  getLibraryChapterCacheTag,
  getLibraryLessonCacheTag,
} from "../../cache/tags";

/** startChapterId begins Build my plan at the played chapter; null lets normal level/placement choose from the course beginning. */
export type LessonFit = {
  chapter: { id: string; lessonCount: number; lessonNumber: number; title: string };
  course: {
    chapterCount: number;
    id: string;
    minutes: number;
    startChapterId: string | null;
    title: string;
  } | null;
};

async function findHomeCourse({
  chapterId,
  courseId,
}: {
  chapterId: string;
  courseId: string | null;
}): Promise<LessonFit["course"]> {
  if (!courseId) {
    return null;
  }

  cacheTag(getCourseCacheTag(courseId));

  const [course, lessons, first, placed] = await Promise.all([
    prisma.course.findFirst({
      select: { _count: { select: { courseChapters: true } }, id: true, title: true },
      where: { id: courseId, isPublished: true, visibility: "public" },
    }),
    prisma.chapterLesson.findMany({
      select: { lesson: { select: { estimatedMinutes: true } } },
      where: { chapter: { courses: { some: { courseId } } } },
    }),
    prisma.courseChapter.findFirst({
      orderBy: [{ level: "asc" }, { position: "asc" }],
      where: { courseId },
    }),
    prisma.courseChapter.count({ where: { chapterId, courseId } }),
  ]);

  const startsAtChapter = placed > 0 && first?.chapterId !== chapterId;

  return course
    ? {
        chapterCount: course._count.courseChapters,
        id: course.id,
        minutes: lessons.reduce((sum, item) => sum + item.lesson.estimatedMinutes, 0),
        startChapterId: startsAtChapter ? chapterId : null,
        title: course.title,
      }
    : null;
}

/** Shared cached read of public content only. */
export async function getLessonFit({ lessonId }: { lessonId: string }): Promise<LessonFit | null> {
  "use cache";

  if (!isUuid(lessonId)) {
    return null;
  }

  cacheTag(getLibraryLessonCacheTag(lessonId));

  const lesson = await prisma.lesson.findFirst({
    select: {
      homeChapter: {
        select: {
          homeCourseId: true,
          id: true,
          lessons: { orderBy: { position: "asc" }, select: { lessonId: true } },
          title: true,
        },
      },
    },
    where: { id: lessonId, visibility: "public" },
  });

  const chapter = lesson?.homeChapter;

  if (!chapter) {
    return null;
  }

  cacheTag(getLibraryChapterCacheTag(chapter.id));

  return {
    chapter: {
      id: chapter.id,
      lessonCount: chapter.lessons.length,
      lessonNumber: chapter.lessons.findIndex((item) => item.lessonId === lessonId) + 1,
      title: chapter.title,
    },
    course: await findHomeCourse({ chapterId: chapter.id, courseId: chapter.homeCourseId }),
  };
}
