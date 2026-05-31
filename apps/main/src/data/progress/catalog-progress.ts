import "server-only";
import { getChapterProgress } from "@zoonk/core/progress/chapters";
import { getLessonProgress } from "@zoonk/core/progress/lessons";
import { getSession } from "@zoonk/core/users/session/get";
import { getPublishedChapterWhere, getPublishedLessonWhere, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { cache } from "react";

export type ContinueLessonProgress = {
  completedItems: number;
  totalItems: number;
  unit: "chapters" | "lessons";
};

/**
 * Course and chapter page components can independently ask for chapter-card
 * progress. React cache keeps repeated reads for the same course inside one
 * server render from issuing duplicate progress queries.
 */
export const getCatalogChapterProgress = cache(async (courseId: string) =>
  getChapterProgress({ courseId }),
);

/**
 * The Continue button and lesson grid both need the same lesson completion
 * rows on chapter pages. Caching by chapter id keeps those sibling Suspense
 * boundaries independent without paying for the query twice in one render.
 */
export const getCatalogLessonProgress = cache(async (chapterId: string) =>
  getLessonProgress({ chapterId }),
);

/**
 * Course-level progress counts completed chapters, not generated lesson rows.
 * Lessons are generated on demand, so chapter completions are the stable unit
 * learners expect when scanning overall course progress.
 */
export const getCourseContinueProgress = cache(
  async (courseId: string): Promise<ContinueLessonProgress> => {
    const [completedItems, totalItems] = await Promise.all([
      countCompletedPublishedCourseChapters(courseId),
      countPublishedCourseChapters(courseId),
    ]);

    return { completedItems, totalItems, unit: "chapters" };
  },
);

/**
 * Chapter-level progress still counts lessons because chapter pages list the
 * concrete lesson rows. Reusing cached lesson progress keeps this aligned with
 * the status badges rendered by the lesson grid.
 */
export const getChapterContinueProgress = cache(
  async (chapterId: string): Promise<ContinueLessonProgress> => {
    const [progressRows, totalItems] = await Promise.all([
      getCatalogLessonProgress(chapterId),
      countPublishedChapterLessons(chapterId),
    ]);

    return {
      completedItems: progressRows.filter((row) => row.isCompleted).length,
      totalItems,
      unit: "lessons",
    };
  },
);

/**
 * Anonymous users have no durable completions, but the course button still
 * needs a zero count against the visible chapter total.
 */
async function countCompletedPublishedCourseChapters(courseId: string) {
  const session = await getSession();
  const userId = session?.user.id;

  if (!userId) {
    return 0;
  }

  const { data } = await safeAsync(() =>
    prisma.chapterCompletion.count({
      where: { chapter: getPublishedChapterWhere({ chapterWhere: { courseId } }), userId },
    }),
  );

  return data ?? 0;
}

/**
 * Course progress needs the visible chapter total even when none of those
 * chapters have generated lesson content yet.
 */
async function countPublishedCourseChapters(courseId: string) {
  const { data } = await safeAsync(() =>
    prisma.chapter.count({ where: getPublishedChapterWhere({ chapterWhere: { courseId } }) }),
  );

  return data ?? 0;
}

/**
 * Chapter progress uses the visible lesson total so the Continue button and
 * lesson grid agree about the same generated lesson set.
 */
async function countPublishedChapterLessons(chapterId: string) {
  const { data } = await safeAsync(() =>
    prisma.lesson.count({ where: getPublishedLessonWhere({ chapterWhere: { id: chapterId } }) }),
  );

  return data ?? 0;
}
