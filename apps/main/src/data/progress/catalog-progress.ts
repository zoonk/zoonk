import "server-only";
import {
  getLessonKindExclusionCacheArgs,
  getLessonKindExclusionWhere,
} from "@zoonk/core/lessons/kind-exclusions";
import { getChapterProgress } from "@zoonk/core/progress/chapters";
import { getLessonProgress } from "@zoonk/core/progress/lessons";
import {
  type LessonKind,
  getPublishedChapterWhere,
  getPublishedLessonWhere,
  prisma,
} from "@zoonk/db";
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
const cachedCatalogChapterProgress = cache(
  async (courseId: string, ...excludedLessonKinds: LessonKind[]) =>
    getChapterProgress({ courseId, excludedLessonKinds }),
);

export function getCatalogChapterProgress(
  courseId: string,
  excludedLessonKinds: LessonKind[] = [],
) {
  return cachedCatalogChapterProgress(
    courseId,
    ...getLessonKindExclusionCacheArgs({ excludedLessonKinds }),
  );
}

/**
 * The Continue button and lesson grid both need the same lesson completion
 * rows on chapter pages. Caching by chapter id keeps those sibling Suspense
 * boundaries independent without paying for the query twice in one render.
 */
const cachedCatalogLessonProgress = cache(
  async (chapterId: string, ...excludedLessonKinds: LessonKind[]) =>
    getLessonProgress({ chapterId, excludedLessonKinds }),
);

export function getCatalogLessonProgress(
  chapterId: string,
  excludedLessonKinds: LessonKind[] = [],
) {
  return cachedCatalogLessonProgress(
    chapterId,
    ...getLessonKindExclusionCacheArgs({ excludedLessonKinds }),
  );
}

/**
 * A chapter counts as complete on the course CTA when every visible lesson is
 * complete. Reusing the same filtered chapter rows as the cards prevents a
 * hidden lesson type from keeping the course progress suffix stuck behind the
 * lesson set the learner chose not to see.
 */
const cachedCourseContinueProgress = cache(
  async (
    courseId: string,
    ...excludedLessonKinds: LessonKind[]
  ): Promise<ContinueLessonProgress> => {
    const [chapterProgressRows, totalItems] = await Promise.all([
      cachedCatalogChapterProgress(courseId, ...excludedLessonKinds),
      countPublishedCourseChapters(courseId),
    ]);

    return {
      completedItems: countCompletedChapterProgressRows({ rows: chapterProgressRows }),
      totalItems,
      unit: "chapters",
    };
  },
);

export function getCourseContinueProgress(
  courseId: string,
  excludedLessonKinds: LessonKind[] = [],
) {
  return cachedCourseContinueProgress(
    courseId,
    ...getLessonKindExclusionCacheArgs({ excludedLessonKinds }),
  );
}

/**
 * Chapter-level progress still counts lessons because chapter pages list the
 * concrete lesson rows. Reusing cached lesson progress keeps this aligned with
 * the status badges rendered by the lesson grid.
 */
const cachedChapterContinueProgress = cache(
  async (
    chapterId: string,
    ...excludedLessonKinds: LessonKind[]
  ): Promise<ContinueLessonProgress> => {
    const [progressRows, totalItems] = await Promise.all([
      cachedCatalogLessonProgress(chapterId, ...excludedLessonKinds),
      countPublishedChapterLessons({ chapterId, excludedLessonKinds }),
    ]);

    return {
      completedItems: progressRows.filter((row) => row.isCompleted).length,
      totalItems,
      unit: "lessons",
    };
  },
);

export function getChapterContinueProgress(
  chapterId: string,
  excludedLessonKinds: LessonKind[] = [],
) {
  return cachedChapterContinueProgress(
    chapterId,
    ...getLessonKindExclusionCacheArgs({ excludedLessonKinds }),
  );
}

/**
 * Empty chapters should not count as completed just because there are no
 * visible lessons left after filtering. They stay at zero progress until the
 * course has at least one visible completed lesson in that chapter.
 */
function countCompletedChapterProgressRows({
  rows,
}: {
  rows: Awaited<ReturnType<typeof getCatalogChapterProgress>>;
}) {
  return rows.filter((row) => row.totalLessons > 0 && row.completedLessons >= row.totalLessons)
    .length;
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
async function countPublishedChapterLessons({
  chapterId,
  excludedLessonKinds,
}: {
  chapterId: string;
  excludedLessonKinds: LessonKind[];
}) {
  const { data } = await safeAsync(() =>
    prisma.lesson.count({
      where: getPublishedLessonWhere({
        chapterWhere: { id: chapterId },
        lessonWhere: getLessonKindExclusionWhere({ excludedLessonKinds }),
      }),
    }),
  );

  return data ?? 0;
}
