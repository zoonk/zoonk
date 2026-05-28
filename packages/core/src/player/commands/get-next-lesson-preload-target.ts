import "server-only";
import { type GenerationStatus, getPublishedChapterWhere, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import {
  type NextLessonInCourse,
  getNextLessonInCourse,
} from "../../lessons/get-next-lesson-in-course";
import { getCompletableLessonWhere } from "./_utils/completable-lesson";

const preloadableGenerationStatuses = new Set<GenerationStatus>(["pending", "failed"]);

export type NextPreloadTarget =
  | { kind: "chapter"; chapterId: string }
  | { kind: "lesson"; lessonId: string };

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
 * Callers that already have the next lesson row can reuse the same preload
 * eligibility rule without doing another current-lesson lookup.
 */
function getNextLessonPreloadId({
  nextLesson,
}: {
  nextLesson: NextLessonInCourse | null;
}): string | null {
  if (!isPreloadableNextLesson(nextLesson)) {
    return null;
  }

  return nextLesson.lessonId;
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
 * The second-step preload entry point needs one structural decision: prefer a
 * concrete next lesson when it exists, otherwise generate the next empty
 * chapter if the learner is at the chapter boundary.
 */
async function getNextPreloadTargetAfterLessonPosition({
  chapterId,
  chapterPosition,
  courseId,
  lessonPosition,
}: {
  chapterId: string;
  chapterPosition: number;
  courseId: string;
  lessonPosition: number;
}): Promise<NextPreloadTarget | null> {
  const nextLesson = await getNextLessonInCourse({
    chapterId,
    chapterPosition,
    courseId,
    lessonPosition,
  });

  const nextLessonId = getNextLessonPreloadId({ nextLesson });

  if (nextLessonId) {
    return { kind: "lesson", lessonId: nextLessonId };
  }

  if (nextLesson) {
    return null;
  }

  const nextChapter = await getNextChapterPreloadCandidate({ chapterPosition, courseId });

  return getChapterPreloadTarget(nextChapter);
}

/**
 * The browser only proves that a learner interacted with the current lesson.
 * This command derives the next preload target on the server so callers do not
 * trust a client-provided lesson or chapter id for an expensive AI job.
 */
export async function getNextPreloadTarget({
  lessonId,
  userId,
}: {
  lessonId: string;
  userId: string;
}): Promise<NextPreloadTarget | null> {
  if (!isUuid(lessonId) || !isUuid(userId)) {
    return null;
  }

  const lesson = await prisma.lesson.findFirst({
    include: { chapter: true },
    where: getCompletableLessonWhere({ lessonId, userId }),
  });

  if (!lesson) {
    return null;
  }

  return getNextPreloadTargetAfterLessonPosition({
    chapterId: lesson.chapterId,
    chapterPosition: lesson.chapter.position,
    courseId: lesson.chapter.courseId,
    lessonPosition: lesson.position,
  });
}
