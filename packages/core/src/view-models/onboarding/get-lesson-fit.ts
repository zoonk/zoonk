import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { cacheTag } from "next/cache";
import {
  getCourseCacheTag,
  getLibraryChapterCacheTag,
  getLibraryLessonCacheTag,
} from "../../cache/tags";

/**
 * Where a lesson fits, for the end of a guest's lesson: "Part of Quantum physics · Overview",
 * its chapter and position, and the course's size. The course is also what "Build my plan"
 * starts, from `startChapterId`: the lesson's own chapter, where the guest already began, or the
 * course's beginning (null) when that's the first chapter anyway, so the level and placement
 * find where they start.
 */
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

  // A chapter its course doesn't place (or its first one) starts the course from the beginning.
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

/** The same for everyone: only public content from the lesson's home chapter and course. */
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
