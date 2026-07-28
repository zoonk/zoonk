import "server-only";
import { type LessonKind } from "@zoonk/db";
import { getCourseById } from "../courses/get-course-by-id";
import { getSession } from "../users/get-session";
import { getLessonVisibility } from "../users/lesson-visibility";
import { getProgressSession, tagProgressScope } from "./_utils/progress-cache";
import { calculateCourseContinueProgressPercent } from "./calculate-continue-progress";
import { getChapterProgress as calculateChapterProgress } from "./get-chapter-progress";
import {
  type PublishedCourseChapter,
  listDurableChapterCompletionIds,
  listPublishedCourseChapters,
  listPublishedLessonProgressRows,
} from "./progress-queries";

/**
 * Adds generation state to each calculated chapter row so the shared course
 * percentage can estimate still-pending chapter sizes with the same rule used
 * by Main's continuation control.
 */
function toCourseProgressPercentageChapter({
  chapter,
  progressByChapterId,
}: {
  chapter: PublishedCourseChapter;
  progressByChapterId: Map<
    string,
    { chapterId: string; completedLessons: number; totalLessons: number }
  >;
}) {
  const progress = progressByChapterId.get(chapter.chapterId);

  return {
    completedLessons: progress?.completedLessons ?? 0,
    generationStatus: chapter.generationStatus,
    totalLessons: progress?.totalLessons ?? 0,
  };
}

/**
 * Loads one authenticated learner's detailed and aggregate course progress from
 * the same curriculum snapshot so the two API fields cannot drift.
 */
async function loadCourseProgress({
  courseId,
  excludedLessonKinds,
  userId,
}: {
  courseId: string;
  excludedLessonKinds: LessonKind[];
  userId: string | null;
}) {
  const scope = { courseId } as const;

  if (!userId) {
    return { chapters: [], percentComplete: null };
  }

  const [publishedChapters, durableChapterCompletionIds, rows] = await Promise.all([
    listPublishedCourseChapters({ courseId }),
    listDurableChapterCompletionIds({ excludedLessonKinds, scope, userId }),
    listPublishedLessonProgressRows({ excludedLessonKinds, scope, userId }),
  ]);

  const chapters = calculateChapterProgress({
    chapters: publishedChapters,
    durableChapterCompletionIds,
    rows,
  });

  const progressByChapterId = new Map(chapters.map((chapter) => [chapter.chapterId, chapter]));

  const percentageChapters = publishedChapters.map((chapter) =>
    toCourseProgressPercentageChapter({ chapter, progressByChapterId }),
  );

  return {
    chapters,
    percentComplete: calculateCourseContinueProgressPercent({ chapters: percentageChapters }),
  };
}

/**
 * Returns chapter-level progress for the authenticated learner. Authentication
 * remains inside core so callers cannot select another user's completion rows.
 */
export async function getCourseProgress({
  courseId,
  excludedLessonKinds = [],
}: {
  courseId: string;
  excludedLessonKinds?: LessonKind[];
}) {
  "use cache: private";

  tagProgressScope({ courseId });

  const session = await getProgressSession();

  const progress = await loadCourseProgress({
    courseId,
    excludedLessonKinds,
    userId: session?.user.id ?? null,
  });

  return progress.chapters;
}

/**
 * Returns the complete course progress API resource using the authenticated
 * learner's durable lesson visibility. Core owns both preference resolution
 * and progress calculation so delivery apps cannot accidentally diverge.
 */
export async function getCourseProgressResource({ courseId }: { courseId: string }) {
  const [course, session, { hiddenLessonKinds }] = await Promise.all([
    getCourseById({ courseId }),
    getSession(),
    getLessonVisibility(),
  ]);

  if (!course) {
    return null;
  }

  return loadCourseProgress({
    courseId,
    excludedLessonKinds: hiddenLessonKinds,
    userId: session?.user.id ?? null,
  });
}
