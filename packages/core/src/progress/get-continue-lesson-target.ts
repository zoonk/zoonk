import { type LessonScope } from "../lessons/lesson-scope";
import { type NextLessonState } from "./get-next-lesson-state";
import { type PublishedCourseChapter } from "./progress-queries";

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

export type ContinueTarget = ContinueChapterTarget | ContinueLessonTarget;

export type ContinueLessonTargetInput = {
  chapters: PublishedCourseChapter[];
  scope: LessonScope;
  state: NextLessonState | null;
};

export type ActiveCatalogTarget = { chapterSlug: string; lessonSlug?: string };

/**
 * The catalog's quiet current-item shortcut only appears after the learner has
 * completed something. Deriving it from the continuation result lets the app
 * reuse the same cached query leaves and pure continuation rules for both
 * catalog controls.
 */
export function toActiveCatalogTarget(target: ContinueTarget | null): ActiveCatalogTarget | null {
  if (!target?.hasStarted) {
    return null;
  }

  if ("lessonSlug" in target) {
    return { chapterSlug: target.chapterSlug, lessonSlug: target.lessonSlug };
  }

  return { chapterSlug: target.chapterSlug };
}

/**
 * Maps already-resolved curriculum and progress state to the destination that
 * start, continue, and review buttons should use. Authentication, permissions,
 * caching, and data loading stay in the app adapter that builds this input.
 */
export function getContinueLessonTarget({
  chapters,
  scope,
  state,
}: ContinueLessonTargetInput): ContinueTarget | null {
  if (!state) {
    return null;
  }

  const pendingChapterTarget = getPendingChapterTarget({ chapters, scope, state });

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
function getPendingChapterTarget({
  chapters,
  scope,
  state,
}: {
  chapters: PublishedCourseChapter[];
  scope: LessonScope;
  state: NextLessonState;
}): ContinueChapterTarget | null {
  if (!("courseId" in scope) || !state.completed || state.scopeDurablyCompleted) {
    return null;
  }

  const nextChapter = chapters.find((chapter) => chapter.chapterPosition > state.chapterPosition);

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
