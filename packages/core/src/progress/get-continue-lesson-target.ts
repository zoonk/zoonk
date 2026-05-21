import { type LessonScope, findLastCompleted } from "@zoonk/core/lessons/last-completed";
import { getNextChapterInCourse } from "../lessons/get-next-chapter-in-course";
import { getSession } from "../users/get-user-session";
import { type NextLessonState, getNextLessonStateForUser } from "./get-next-lesson-state";

type ContinueLessonTargetBase = {
  brandSlug: string | null;
  chapterSlug: string;
  completed: boolean;
  courseSlug: string;
  hasStarted: boolean;
};

type ContinueLessonTarget = ContinueLessonTargetBase & {
  canPrefetch: boolean;
  lessonPosition: number;
  lessonSlug: string;
};

type ContinueChapterTarget = ContinueLessonTargetBase & { canPrefetch: false; completed: false };

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
}): Promise<ContinueChapterTarget | ContinueLessonTarget | null> {
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

  const pendingChapterTarget = await getPendingChapterTarget({ scope, state });

  if (pendingChapterTarget) {
    return pendingChapterTarget;
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

/**
 * A course can be complete relative to its generated lessons while a later
 * published chapter still has no lesson shells. In that state the course CTA
 * should continue to the chapter page, not review the completed lesson.
 */
async function getPendingChapterTarget({
  scope,
  state,
}: {
  scope: LessonScope;
  state: NextLessonState;
}): Promise<ContinueChapterTarget | null> {
  if (!("courseId" in scope) || !state.completed || state.scopeDurablyCompleted) {
    return null;
  }

  const nextChapter = await getNextChapterInCourse({
    chapterPosition: state.chapterPosition,
    courseId: state.courseId,
  });

  if (!nextChapter) {
    return null;
  }

  return {
    brandSlug: nextChapter.brandSlug,
    canPrefetch: false,
    chapterSlug: nextChapter.chapterSlug,
    completed: false,
    courseSlug: nextChapter.courseSlug,
    hasStarted: true,
  };
}
