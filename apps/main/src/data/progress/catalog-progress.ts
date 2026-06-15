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
import {
  type CourseContinueProgressChapter,
  calculateCourseContinueProgressPercent,
  calculateProgressPercent,
} from "./_utils/continue-progress-percent";

export type ContinueLessonProgress = { percentComplete: number };

/**
 * Course and chapter page components can independently ask for chapter-card
 * progress. React cache keeps repeated reads for the same course inside one
 * server render from issuing duplicate progress queries.
 */
const cachedCatalogChapterProgress = cache(
  async (courseId: string, headers: Headers | undefined, ...excludedLessonKinds: LessonKind[]) =>
    getChapterProgress({ courseId, excludedLessonKinds, headers }),
);

export function getCatalogChapterProgress({
  courseId,
  excludedLessonKinds = [],
  headers,
}: {
  courseId: string;
  excludedLessonKinds?: LessonKind[];
  headers?: Headers;
}) {
  return cachedCatalogChapterProgress(
    courseId,
    headers,
    ...getLessonKindExclusionCacheArgs({ excludedLessonKinds }),
  );
}

/**
 * The Continue button and lesson grid both need the same lesson completion
 * rows on chapter pages. Caching by chapter id keeps those sibling Suspense
 * boundaries independent without paying for the query twice in one render.
 */
const cachedCatalogLessonProgress = cache(
  async (chapterId: string, headers: Headers | undefined, ...excludedLessonKinds: LessonKind[]) =>
    getLessonProgress({ chapterId, excludedLessonKinds, headers }),
);

export function getCatalogLessonProgress({
  chapterId,
  excludedLessonKinds = [],
  headers,
}: {
  chapterId: string;
  excludedLessonKinds?: LessonKind[];
  headers?: Headers;
}) {
  return cachedCatalogLessonProgress(
    chapterId,
    headers,
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
    headers: Headers | undefined,
    ...excludedLessonKinds: LessonKind[]
  ): Promise<ContinueLessonProgress | null> => {
    const [chapterProgressRows, chapters] = await Promise.all([
      cachedCatalogChapterProgress(courseId, headers, ...excludedLessonKinds),
      listPublishedCourseChaptersForProgress({ courseId }),
    ]);

    const progressRowsByChapterId = new Map(chapterProgressRows.map((row) => [row.chapterId, row]));

    const progressChapters = chapters.map((chapter) =>
      getCourseContinueProgressChapter({ chapter, progressRowsByChapterId }),
    );

    return toContinueLessonProgress({
      percentComplete: calculateCourseContinueProgressPercent({ chapters: progressChapters }),
    });
  },
);

export function getCourseContinueProgress({
  courseId,
  excludedLessonKinds = [],
  headers,
}: {
  courseId: string;
  excludedLessonKinds?: LessonKind[];
  headers?: Headers;
}) {
  return cachedCourseContinueProgress(
    courseId,
    headers,
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
    headers: Headers | undefined,
    ...excludedLessonKinds: LessonKind[]
  ): Promise<ContinueLessonProgress | null> => {
    const [progressRows, totalItems] = await Promise.all([
      cachedCatalogLessonProgress(chapterId, headers, ...excludedLessonKinds),
      countPublishedChapterLessons({ chapterId, excludedLessonKinds }),
    ]);

    return toContinueLessonProgress({
      percentComplete: calculateProgressPercent({
        completedItems: progressRows.filter((row) => row.isCompleted).length,
        totalItems,
      }),
    });
  },
);

export function getChapterContinueProgress({
  chapterId,
  excludedLessonKinds = [],
  headers,
}: {
  chapterId: string;
  excludedLessonKinds?: LessonKind[];
  headers?: Headers;
}) {
  return cachedChapterContinueProgress(
    chapterId,
    headers,
    ...getLessonKindExclusionCacheArgs({ excludedLessonKinds }),
  );
}

/**
 * The UI only needs a visible percentage. Returning null lets callers keep the
 * existing no-progress fallback when there is no useful denominator.
 */
function toContinueLessonProgress({
  percentComplete,
}: {
  percentComplete: number | null;
}): ContinueLessonProgress | null {
  if (percentComplete === null) {
    return null;
  }

  return { percentComplete };
}

/**
 * Course estimates need chapter generation status in addition to the lesson
 * progress rows, because pending chapters may not have lesson rows yet.
 */
async function listPublishedCourseChaptersForProgress({ courseId }: { courseId: string }) {
  const { data } = await safeAsync(() =>
    prisma.chapter.findMany({
      orderBy: { position: "asc" },
      where: getPublishedChapterWhere({ chapterWhere: { courseId } }),
    }),
  );

  return data ?? [];
}

/**
 * The course estimate consumes one row per published chapter, so chapters with
 * no visible lessons still contribute their generation status and zero counts.
 */
function getCourseContinueProgressChapter({
  chapter,
  progressRowsByChapterId,
}: {
  chapter: Awaited<ReturnType<typeof listPublishedCourseChaptersForProgress>>[number];
  progressRowsByChapterId: Map<string, { completedLessons: number; totalLessons: number }>;
}): CourseContinueProgressChapter {
  const progress = progressRowsByChapterId.get(chapter.id);

  return {
    completedLessons: progress?.completedLessons ?? 0,
    generationStatus: chapter.generationStatus,
    totalLessons: progress?.totalLessons ?? 0,
  };
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
