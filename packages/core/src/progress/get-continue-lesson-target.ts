import { type LessonScope } from "../lessons/lesson-scope";
import { type NextLessonState } from "./get-next-lesson-state";
import { type PublishedCourseChapter } from "./progress-queries";

type ContinueLessonTargetBase = {
  brandSlug: string | null;
  chapterId: string;
  chapterSlug: string;
  completed: boolean;
  courseId: string;
  courseSlug: string;
  hasStarted: boolean;
};

type ContinueLessonTarget = ContinueLessonTargetBase & {
  canPrefetch: boolean;
  lessonId: string;
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
    chapterId: state.chapterId,
    chapterSlug: state.chapterSlug,
    completed: state.completed,
    courseId: state.courseId,
    courseSlug: state.courseSlug,
    hasStarted: state.hasStarted,
    lessonId: state.lessonId,
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
    chapterId: nextChapter.chapterId,
    chapterSlug: nextChapter.chapterSlug,
    completed: false,
    courseId: nextChapter.courseId,
    courseSlug: nextChapter.courseSlug,
    hasStarted: true,
  };
}
