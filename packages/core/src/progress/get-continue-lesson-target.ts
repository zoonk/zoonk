import { type LessonScope, findLastCompleted } from "@zoonk/core/lessons/last-completed";
import { cache } from "react";
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
type LessonScopeKind = "chapterId" | "courseId" | "lessonId";
type LessonScopeParts = { id: string; kind: LessonScopeKind };

/**
 * React cache needs stable positional values. Splitting the scope union into a
 * key and id lets the sidebar CTA and catalog active shortcut share one
 * progress lookup when they resolve the same course, chapter, or lesson.
 */
function getLessonScopeParts(scope: LessonScope): LessonScopeParts {
  if ("courseId" in scope) {
    return { id: scope.courseId, kind: "courseId" };
  }

  if ("chapterId" in scope) {
    return { id: scope.chapterId, kind: "chapterId" };
  }

  return { id: scope.lessonId, kind: "lessonId" };
}

/**
 * Rebuilds the public scope union from cached primitive arguments so the
 * learner-aware continuation code can stay object-shaped and readable.
 */
function getLessonScopeFromParts({ id, kind }: LessonScopeParts): LessonScope {
  if (kind === "courseId") {
    return { courseId: id };
  }

  if (kind === "chapterId") {
    return { chapterId: id };
  }

  return { lessonId: id };
}

/**
 * Resolves the lesson destination that start/continue/review buttons should
 * use for a learner. This stays separate from structural course navigation
 * because it folds in session state, durable completions, and prefetch safety.
 */
const cachedGetContinueLessonTarget = cache(
  async (
    scopeKind: LessonScopeKind,
    scopeId: string,
    headers?: Headers,
  ): Promise<ContinueChapterTarget | ContinueLessonTarget | null> => {
    const scope = getLessonScopeFromParts({ id: scopeId, kind: scopeKind });

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
  },
);

export function getContinueLessonTarget({
  headers,
  scope,
}: {
  headers?: Headers;
  scope: LessonScope;
}): Promise<ContinueChapterTarget | ContinueLessonTarget | null> {
  const { id, kind } = getLessonScopeParts(scope);

  return cachedGetContinueLessonTarget(kind, id, headers);
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
