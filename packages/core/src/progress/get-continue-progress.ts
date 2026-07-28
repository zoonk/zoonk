import "server-only";
import { type LessonKind } from "@zoonk/db";
import { getProgressSession, tagProgressScope } from "./_utils/progress-cache";
import {
  type CourseContinueProgressChapter,
  calculateCourseContinueProgressPercent,
  calculateProgressPercent,
} from "./calculate-continue-progress";
import { getChapterProgress as calculateChapterProgress } from "./get-chapter-progress";
import { getLessonProgress as calculateLessonProgress } from "./get-lesson-progress";
import {
  listDurableChapterCompletionIds,
  listPublishedCourseChapters,
  listPublishedLessonProgressRows,
} from "./progress-queries";

export type ContinueProgress = { percentComplete: number };

/**
 * Converts a useful percentage into the stable progress resource returned to
 * delivery apps. A missing denominator stays `null`.
 */
function toContinueProgress(percentComplete: number | null): ContinueProgress | null {
  if (percentComplete === null) {
    return null;
  }

  return { percentComplete };
}

/**
 * Combines one published chapter with its visible learner progress so pending
 * chapters can participate in the course-size estimate.
 */
function getCourseContinueProgressChapter({
  chapterId,
  generationStatus,
  progressRowsByChapterId,
}: {
  chapterId: string;
  generationStatus: string;
  progressRowsByChapterId: Map<string, { completedLessons: number; totalLessons: number }>;
}): CourseContinueProgressChapter {
  const progress = progressRowsByChapterId.get(chapterId);

  return {
    completedLessons: progress?.completedLessons ?? 0,
    generationStatus,
    totalLessons: progress?.totalLessons ?? 0,
  };
}

/**
 * Returns the learner's course completion percentage using the same visibility
 * and generated-chapter estimate across web, API, and native clients.
 */
export async function getCourseContinueProgress({
  courseId,
  excludedLessonKinds = [],
}: {
  courseId: string;
  excludedLessonKinds?: LessonKind[];
}): Promise<ContinueProgress | null> {
  "use cache: private";

  const scope = { courseId } as const;
  tagProgressScope(scope);

  const session = await getProgressSession();
  const userId = session?.user.id ?? null;

  const [chapters, durableChapterCompletionIds, rows] = await Promise.all([
    listPublishedCourseChapters({ courseId }),
    listDurableChapterCompletionIds({ excludedLessonKinds, scope, userId }),
    listPublishedLessonProgressRows({ excludedLessonKinds, scope, userId }),
  ]);

  const chapterProgress = calculateChapterProgress({ chapters, durableChapterCompletionIds, rows });

  const progressRowsByChapterId = new Map(chapterProgress.map((row) => [row.chapterId, row]));

  const progressChapters = chapters.map(({ chapterId, generationStatus }) =>
    getCourseContinueProgressChapter({ chapterId, generationStatus, progressRowsByChapterId }),
  );

  return toContinueProgress(calculateCourseContinueProgressPercent({ chapters: progressChapters }));
}

/**
 * Returns the learner's chapter completion percentage from the same filtered
 * lesson rows used by chapter progress.
 */
export async function getChapterContinueProgress({
  chapterId,
  excludedLessonKinds = [],
}: {
  chapterId: string;
  excludedLessonKinds?: LessonKind[];
}): Promise<ContinueProgress | null> {
  "use cache: private";

  const scope = { chapterId } as const;
  tagProgressScope(scope);

  const session = await getProgressSession();

  const rows = await listPublishedLessonProgressRows({
    excludedLessonKinds,
    scope,
    userId: session?.user.id ?? null,
  });

  const progressRows = calculateLessonProgress({ rows });

  return toContinueProgress(
    calculateProgressPercent({
      completedItems: progressRows.filter((row) => row.isCompleted).length,
      totalItems: progressRows.length,
    }),
  );
}
