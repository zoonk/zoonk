import "server-only";
import { type GenerationStatus, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import {
  type NextLessonInCourse,
  getNextLessonInCourse,
} from "../../lessons/get-next-lesson-in-course";
import { getCompletableLessonWhere } from "./_utils/completable-lesson";

const preloadableGenerationStatuses = new Set<GenerationStatus>(["pending", "failed"]);

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
 * Completion already has the next lesson row loaded, so it can reuse the same
 * preload eligibility rule without doing another current-lesson lookup.
 */
export function getNextLessonPreloadId({
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
 * The browser only proves that a learner interacted with the current lesson.
 * This command derives the next structural lesson on the server so callers do
 * not trust a client-provided target for an expensive AI generation job.
 */
export async function getNextLessonPreloadTarget({
  lessonId,
  userId,
}: {
  lessonId: string;
  userId: string;
}): Promise<string | null> {
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

  const nextLesson = await getNextLessonInCourse({
    chapterId: lesson.chapterId,
    chapterPosition: lesson.chapter.position,
    courseId: lesson.chapter.courseId,
    lessonPosition: lesson.position,
  });

  return getNextLessonPreloadId({ nextLesson });
}
