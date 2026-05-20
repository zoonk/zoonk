import { type LessonScope, findLastCompleted } from "@zoonk/core/lessons/last-completed";
import { getSession } from "../users/get-user-session";
import { getNextLessonStateForUser } from "./get-next-lesson-state";

/**
 * Resolves the lesson destination that start/continue/review buttons should
 * use for a learner. This stays separate from structural course navigation
 * because it folds in session state, durable completions, and prefetch safety.
 */
export async function getContinueLessonTarget({
  scope,
  headers,
}: {
  scope: LessonScope;
  headers?: Headers;
}): Promise<{
  lessonPosition: number;
  brandSlug: string | null;
  canPrefetch: boolean;
  chapterSlug: string;
  completed: boolean;
  courseSlug: string;
  hasStarted: boolean;
  lessonSlug: string;
} | null> {
  const session = await getSession(headers);
  const userId = session?.user.id;
  const lastCompleted = userId ? await findLastCompleted(userId, scope) : null;

  const state = await getNextLessonStateForUser({
    after: lastCompleted
      ? {
          chapterPosition: lastCompleted.chapterPosition,
          lessonId: lastCompleted.lessonId,
          lessonPosition: lastCompleted.lessonPosition,
        }
      : undefined,
    scope,
    userId,
  });

  if (!state) {
    return null;
  }

  return {
    brandSlug: state.brandSlug,
    canPrefetch: state.canPrefetch,
    chapterSlug: state.chapterSlug,
    completed: state.completed,
    courseSlug: state.courseSlug,
    hasStarted: state.hasStarted,
    lessonPosition: state.lessonPosition,
    lessonSlug: state.lessonSlug,
  };
}
