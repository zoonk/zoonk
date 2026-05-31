import "server-only";
import {
  type GenerationStatus,
  getPublishedChapterWhere,
  getPublishedLessonWhere,
  prisma,
} from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { NON_STANDALONE_GENERATED_LESSON_KINDS } from "../../lessons/generated-companion-kinds";
import { getCompletableLessonWhere } from "./_utils/completable-lesson";

const preloadableGenerationStatuses = new Set<GenerationStatus>(["pending", "failed"]);
const maxPreloadTargets = 3;

export type NextPreloadTarget =
  | { kind: "chapter"; chapterId: string }
  | { kind: "lesson"; lessonId: string };

type LessonPreloadCursor = {
  chapterId: string;
  chapterPosition: number;
  courseId: string;
  lessonPosition: number;
};

/**
 * Chapter generation should only be preloaded when the next chapter is still
 * empty and retryable. Running chapters already have a workflow in flight, and
 * completed chapters should expose their first lesson through the normal next
 * lesson lookup instead of starting a second chapter workflow.
 */
async function getNextChapterPreloadCandidate({
  afterChapterPosition,
  courseId,
}: {
  afterChapterPosition: number;
  courseId: string;
}) {
  return prisma.chapter.findFirst({
    include: { _count: { select: { lessons: true } } },
    orderBy: { position: "asc" },
    where: getPublishedChapterWhere({
      chapterWhere: { courseId, position: { gt: afterChapterPosition } },
    }),
  });
}

type NextChapterPreloadCandidate = NonNullable<
  Awaited<ReturnType<typeof getNextChapterPreloadCandidate>>
>;

type NextLessonPreloadCandidate = Awaited<
  ReturnType<typeof getNextLessonPreloadCandidates>
>[number];

/**
 * Finds the next standalone lesson rows in course order. Generated companion
 * rows are skipped because vocabulary and reading generation create translation
 * and listening content.
 */
async function getNextLessonPreloadCandidates({
  chapterId,
  chapterPosition,
  courseId,
  lessonPosition,
}: LessonPreloadCursor) {
  return prisma.lesson.findMany({
    include: { chapter: true },
    orderBy: [{ chapter: { position: "asc" } }, { position: "asc" }],
    take: maxPreloadTargets,
    where: getPublishedLessonWhere({
      courseWhere: { id: courseId },
      lessonWhere: {
        OR: [
          { chapter: { id: chapterId }, position: { gt: lessonPosition } },
          { chapter: { position: { gt: chapterPosition } } },
        ],
        kind: { notIn: [...NON_STANDALONE_GENERATED_LESSON_KINDS] },
      },
    }),
  });
}

/**
 * Early preload should only enqueue work that can still become useful. Pending
 * and failed lessons need generation, while running and completed lessons
 * already have either active work or usable content.
 */
function isPreloadableNextLesson(nextLesson: NextLessonPreloadCandidate): boolean {
  return preloadableGenerationStatuses.has(nextLesson.generationStatus);
}

/**
 * Converts one standalone lesson row into a workflow target only when it still
 * needs generation.
 */
function getLessonPreloadTarget({
  nextLesson,
}: {
  nextLesson: NextLessonPreloadCandidate;
}): NextPreloadTarget | null {
  if (!isPreloadableNextLesson(nextLesson)) {
    return null;
  }

  return { kind: "lesson", lessonId: nextLesson.id };
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
 * Keeps arrays typed after filtering optional lesson and chapter targets.
 */
function isNextPreloadTarget(target: NextPreloadTarget | null): target is NextPreloadTarget {
  return Boolean(target);
}

/**
 * The next empty chapter only matters when fewer than three future lesson rows
 * already exist. That lets chapter generation create the next lesson shells
 * early without replacing concrete lesson rows that are already visible.
 */
async function getChapterPreloadTargetWhenNeeded({
  courseId,
  currentChapterPosition,
  nextLessons,
}: {
  courseId: string;
  currentChapterPosition: number;
  nextLessons: NextLessonPreloadCandidate[];
}): Promise<NextPreloadTarget | null> {
  if (nextLessons.length >= maxPreloadTargets) {
    return null;
  }

  const afterChapterPosition = nextLessons.at(-1)?.chapter.position ?? currentChapterPosition;
  const nextChapter = await getNextChapterPreloadCandidate({ afterChapterPosition, courseId });

  return getChapterPreloadTarget(nextChapter);
}

/**
 * Turns the next three standalone lesson rows into the subset of workflow
 * targets that still need generation.
 */
function getLessonPreloadTargets(nextLessons: NextLessonPreloadCandidate[]) {
  return nextLessons
    .map((nextLesson) => getLessonPreloadTarget({ nextLesson }))
    .filter((target) => isNextPreloadTarget(target));
}

/**
 * Combines lesson and chapter targets without allowing background preload to
 * grow past the small lookahead window used by the player.
 */
function getPreloadTargets({
  chapterTarget,
  lessonTargets,
}: {
  chapterTarget: NextPreloadTarget | null;
  lessonTargets: NextPreloadTarget[];
}): NextPreloadTarget[] {
  return [...lessonTargets, chapterTarget]
    .filter((target) => isNextPreloadTarget(target))
    .slice(0, maxPreloadTargets);
}

/**
 * The second-step preload entry point follows one simple rule: inspect the
 * next three standalone lesson rows, generate the ones that need work, and ask
 * for the next empty chapter only when fewer than three rows already exist.
 */
async function getNextPreloadTargetsAfterLessonPosition(
  cursor: LessonPreloadCursor,
): Promise<NextPreloadTarget[]> {
  const nextLessons = await getNextLessonPreloadCandidates(cursor);

  const lessonTargets = getLessonPreloadTargets(nextLessons);

  const chapterTarget = await getChapterPreloadTargetWhenNeeded({
    courseId: cursor.courseId,
    currentChapterPosition: cursor.chapterPosition,
    nextLessons,
  });

  return getPreloadTargets({ chapterTarget, lessonTargets });
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
  });
}
