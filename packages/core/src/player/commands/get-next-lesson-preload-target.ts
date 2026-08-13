import { type GenerationStatus, getPublishedChapterWhere, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { hasActiveSubscription } from "../../auth/subscription";
import { getLessonAccessRequirement } from "../../lessons/access";
import { NON_STANDALONE_GENERATED_LESSON_KINDS } from "../../lessons/generated-companion-kinds";
import { getPublishedLessonsAfter } from "../../lessons/ordered-course-lessons";
import { getSession } from "../../users/get-session";
import { getCompletableLessonWhere } from "./_utils/completable-lesson";

const preloadableGenerationStatuses = new Set<GenerationStatus>(["pending", "failed"]);
const maxPreloadTargets = 3;

export type NextPreloadTarget =
  | { kind: "chapter"; chapterId: string }
  | { kind: "lesson"; lessonId: string };

type PreloadTargetCandidate = { requiresSubscription: boolean; target: NextPreloadTarget };

type LessonPreloadCursor = { chapterPosition: number; courseId: string; lessonId: string };

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
async function getNextLessonPreloadCandidates({ courseId, lessonId }: LessonPreloadCursor) {
  const lessons = await getPublishedLessonsAfter({
    courseId,
    excludedLessonKinds: [...NON_STANDALONE_GENERATED_LESSON_KINDS],
    lessonId,
  });

  return lessons?.slice(0, maxPreloadTargets) ?? [];
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
}): PreloadTargetCandidate | null {
  if (!isPreloadableNextLesson(nextLesson)) {
    return null;
  }

  return {
    requiresSubscription: getLessonAccessRequirement({ lesson: nextLesson }) === "subscription",
    target: { kind: "lesson", lessonId: nextLesson.id },
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
): PreloadTargetCandidate | null {
  if (!nextChapter) {
    return null;
  }

  if (nextChapter._count.lessons > 0) {
    return null;
  }

  if (!preloadableGenerationStatuses.has(nextChapter.generationStatus)) {
    return null;
  }

  return {
    requiresSubscription: nextChapter.position !== 0,
    target: { chapterId: nextChapter.id, kind: "chapter" },
  };
}

/**
 * Keeps arrays typed after filtering optional lesson and chapter targets.
 */
function isPreloadTargetCandidate(
  candidate: PreloadTargetCandidate | null,
): candidate is PreloadTargetCandidate {
  return Boolean(candidate);
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
}): Promise<PreloadTargetCandidate | null> {
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
    .filter((candidate) => isPreloadTargetCandidate(candidate));
}

/**
 * Combines lesson and chapter targets without allowing background preload to
 * grow past the small lookahead window used by the player.
 */
function getPreloadTargets({
  chapterTarget,
  lessonTargets,
}: {
  chapterTarget: PreloadTargetCandidate | null;
  lessonTargets: PreloadTargetCandidate[];
}): PreloadTargetCandidate[] {
  return [...lessonTargets, chapterTarget]
    .filter((candidate) => isPreloadTargetCandidate(candidate))
    .slice(0, maxPreloadTargets);
}

/**
 * The second-step preload entry point follows one simple rule: inspect the
 * next three standalone lesson rows, generate the ones that need work, and ask
 * for the next empty chapter only when fewer than three rows already exist.
 */
async function getNextPreloadTargetsAfterLesson(
  cursor: LessonPreloadCursor,
): Promise<PreloadTargetCandidate[]> {
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
 * Filters paid generation work through the same subscription capability used
 * by player access. Free first-chapter targets never perform a billing read,
 * while one request-local lookup covers every paid target in the lookahead.
 */
async function getAuthorizedPreloadTargets({
  candidates,
}: {
  candidates: PreloadTargetCandidate[];
}): Promise<NextPreloadTarget[]> {
  if (!candidates.some((candidate) => candidate.requiresSubscription)) {
    return candidates.map((candidate) => candidate.target);
  }

  const canAccessPaidTargets = await hasActiveSubscription();

  return candidates
    .filter((candidate) => !candidate.requiresSubscription || canAccessPaidTargets)
    .map((candidate) => candidate.target);
}

/**
 * The browser only proves that a learner interacted with the current lesson.
 * This resource derives the next preload targets on the server and distinguishes
 * authentication from an unavailable current lesson. Callers never choose the
 * IDs of expensive AI jobs.
 */
export async function getNextPreloadTargetResource({ lessonId }: { lessonId: string }) {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" as const };
  }

  if (!isUuid(lessonId)) {
    return { status: "notFound" as const };
  }

  const lesson = await prisma.lesson.findFirst({
    include: { chapter: true },
    where: getCompletableLessonWhere({ lessonId, userId: session.user.id }),
  });

  if (!lesson) {
    return { status: "notFound" as const };
  }

  const candidates = await getNextPreloadTargetsAfterLesson({
    chapterPosition: lesson.chapter.position,
    courseId: lesson.chapter.courseId,
    lessonId: lesson.id,
  });

  const targets = await getAuthorizedPreloadTargets({ candidates });

  return { status: "ready" as const, targets };
}
