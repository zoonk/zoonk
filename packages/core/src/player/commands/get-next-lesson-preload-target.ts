import "server-only";
import {
  type GenerationStatus,
  type LessonKind,
  getPublishedChapterWhere,
  prisma,
} from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { getBlockingLessonGenerationPrerequisite } from "../../lessons/generation-prerequisites";
import {
  type NextLessonInCourse,
  getNextLessonInCourse,
} from "../../lessons/get-next-lesson-in-course";
import { getCompletableLessonWhere } from "./_utils/completable-lesson";

const preloadableGenerationStatuses = new Set<GenerationStatus>(["pending", "failed"]);
const preloadLookaheadLessonKinds = new Set<LessonKind>(["grammar", "listening", "translation"]);
const maxPreloadTargets = 2;
const maxLookaheadHops = 1;

export type NextPreloadTarget =
  | { kind: "chapter"; chapterId: string }
  | { kind: "lesson"; lessonId: string };

type LessonPreloadCursor = {
  chapterId: string;
  chapterPosition: number;
  courseId: string;
  lessonPosition: number;
};

type LessonPreloadDecision = { shouldContinue: boolean; target: NextPreloadTarget | null };

/**
 * Chapter generation should only be preloaded when the next chapter is still
 * empty and retryable. Running chapters already have a workflow in flight, and
 * completed chapters should expose their first lesson through the normal next
 * lesson lookup instead of starting a second chapter workflow.
 */
async function getNextChapterPreloadCandidate({
  chapterPosition,
  courseId,
}: {
  chapterPosition: number;
  courseId: string;
}) {
  return prisma.chapter.findFirst({
    include: { _count: { select: { lessons: true } } },
    orderBy: { position: "asc" },
    where: getPublishedChapterWhere({
      chapterWhere: { courseId, position: { gt: chapterPosition } },
    }),
  });
}

type NextChapterPreloadCandidate = NonNullable<
  Awaited<ReturnType<typeof getNextChapterPreloadCandidate>>
>;

/**
 * Early preload should only enqueue work that can still become useful. Pending
 * and failed lessons need generation, while running and completed lessons
 * already have either active work or usable content.
 */
function isPreloadableNextLesson(
  nextLesson: NextLessonInCourse | null,
): nextLesson is NextLessonInCourse {
  if (!nextLesson) {
    return false;
  }

  return preloadableGenerationStatuses.has(nextLesson.lessonGenerationStatus);
}

/**
 * Some language lessons are commonly finished before the next heavy generated
 * lesson is ready. These are the only lesson kinds this command may look
 * through, and the shared target cap still prevents broad course generation.
 */
function isPreloadLookaheadLesson({ lessonKind }: NextLessonInCourse): boolean {
  return preloadLookaheadLessonKinds.has(lessonKind);
}

/**
 * Avoids starting workflow runs that the shared prerequisite guard would block
 * anyway. This keeps lookahead generation from skipping over unfinished source
 * lessons while still reusing the same rule the generation workflow enforces.
 */
async function isBlockedByGenerationPrerequisite({
  nextLesson,
}: {
  nextLesson: NextLessonInCourse;
}): Promise<boolean> {
  const blockingPrerequisite = await getBlockingLessonGenerationPrerequisite({
    chapterId: nextLesson.chapterId,
    kind: nextLesson.lessonKind,
    position: nextLesson.lessonPosition,
  });

  return Boolean(blockingPrerequisite);
}

/**
 * Decides whether the next structural lesson should be started and whether the
 * selector may continue behind it. Lookahead lessons can be looked through only
 * when their own source content is already complete.
 */
async function getLessonPreloadDecision({
  nextLesson,
}: {
  nextLesson: NextLessonInCourse;
}): Promise<LessonPreloadDecision> {
  if (await isBlockedByGenerationPrerequisite({ nextLesson })) {
    return { shouldContinue: false, target: null };
  }

  return {
    shouldContinue: isPreloadLookaheadLesson(nextLesson),
    target: isPreloadableNextLesson(nextLesson)
      ? { kind: "lesson", lessonId: nextLesson.lessonId }
      : null,
  };
}

/**
 * Chapter preloading is the fallback for the boundary between generated
 * chapters: if there is no next lesson row yet, the next published chapter
 * can be generated early so its first lesson is ready by the time the learner
 * finishes the current chapter.
 */
function getChapterPreloadTarget(
  nextChapter: NextChapterPreloadCandidate | null,
): NextPreloadTarget | null {
  if (!nextChapter) {
    return null;
  }

  if (nextChapter._count.lessons > 0) {
    return null;
  }

  if (!preloadableGenerationStatuses.has(nextChapter.generationStatus)) {
    return null;
  }

  return { chapterId: nextChapter.id, kind: "chapter" };
}

/**
 * Keeps the returned target list typed after composing the optional current
 * lesson target with any target found behind a lookahead lesson.
 */
function getPreloadTargets(input: {
  laterTargets: NextPreloadTarget[];
  target: NextPreloadTarget | null;
}): NextPreloadTarget[] {
  return input.target ? [input.target, ...input.laterTargets] : input.laterTargets;
}

/**
 * Counts how many target slots remain after the current lesson decision. The
 * cap keeps early preload from becoming broad course generation.
 */
function getRemainingTargetCount({
  remainingTargets,
  target,
}: {
  remainingTargets: number;
  target: NextPreloadTarget | null;
}): number {
  return target ? remainingTargets - 1 : remainingTargets;
}

/**
 * The second-step preload entry point normally starts the immediate next
 * generated lesson. Short language lessons are special: the selector may walk
 * one lookahead hop and start the slower generated lesson behind them too.
 */
async function getNextPreloadTargetsAfterLessonPosition({
  chapterId,
  chapterPosition,
  courseId,
  lessonPosition,
  remainingLookaheadHops,
  remainingTargets,
}: { remainingLookaheadHops: number; remainingTargets: number } & LessonPreloadCursor): Promise<
  NextPreloadTarget[]
> {
  if (remainingTargets <= 0) {
    return [];
  }

  const nextLesson = await getNextLessonInCourse({
    chapterId,
    chapterPosition,
    courseId,
    lessonPosition,
  });

  if (!nextLesson) {
    const nextChapter = await getNextChapterPreloadCandidate({ chapterPosition, courseId });
    const target = getChapterPreloadTarget(nextChapter);

    return target ? [target] : [];
  }

  const decision = await getLessonPreloadDecision({ nextLesson });

  const nextRemainingTargets = getRemainingTargetCount({
    remainingTargets,
    target: decision.target,
  });

  if (!decision.shouldContinue || remainingLookaheadHops <= 0 || nextRemainingTargets <= 0) {
    return getPreloadTargets({ laterTargets: [], target: decision.target });
  }

  const laterTargets = await getNextPreloadTargetsAfterLessonPosition({
    chapterId: nextLesson.chapterId,
    chapterPosition: nextLesson.chapterPosition,
    courseId,
    lessonPosition: nextLesson.lessonPosition,
    remainingLookaheadHops: remainingLookaheadHops - 1,
    remainingTargets: nextRemainingTargets,
  });

  return getPreloadTargets({ laterTargets, target: decision.target });
}

/**
 * The browser only proves that a learner interacted with the current lesson.
 * This command derives the next preload targets on the server so callers do not
 * trust a client-provided lesson or chapter id for an expensive AI job.
 */
export async function getNextPreloadTargets({
  lessonId,
  userId,
}: {
  lessonId: string;
  userId: string;
}): Promise<NextPreloadTarget[]> {
  if (!isUuid(lessonId) || !isUuid(userId)) {
    return [];
  }

  const lesson = await prisma.lesson.findFirst({
    include: { chapter: true },
    where: getCompletableLessonWhere({ lessonId, userId }),
  });

  if (!lesson) {
    return [];
  }

  return getNextPreloadTargetsAfterLessonPosition({
    chapterId: lesson.chapterId,
    chapterPosition: lesson.chapter.position,
    courseId: lesson.chapter.courseId,
    lessonPosition: lesson.position,
    remainingLookaheadHops: maxLookaheadHops,
    remainingTargets: maxPreloadTargets,
  });
}
