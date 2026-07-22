import { getContinueLessonTarget } from "@zoonk/core/progress/continue-lesson-target";
import { type Chapter, type Lesson } from "@zoonk/db";
import { type ContinueLearningProgressState } from "./continue-learning-next-state";
import { type ContinueLearningRow } from "./continue-learning-queries";

export type PendingTarget = {
  chapter: Pick<Chapter, "id" | "slug" | "title">;
  lesson: Pick<Lesson, "description" | "id" | "kind" | "slug" | "title"> | null;
};

/**
 * Converts the pure continuation selector's empty-chapter destination into the
 * richer card payload already loaded with the course outline. A completed
 * review lesson is not pending and therefore does not produce a feed card.
 */
export function getPendingTarget({
  progressState,
  row,
}: {
  progressState: ContinueLearningProgressState;
  row: ContinueLearningRow;
}): PendingTarget | null {
  const target = getContinueLessonTarget({
    chapters: progressState.chapters,
    scope: { courseId: row.courseId },
    state: progressState.state,
  });

  if (!target || "lessonSlug" in target) {
    return null;
  }

  const chapter = progressState.chapters.find(
    (candidate) => candidate.chapterSlug === target.chapterSlug,
  );

  if (!chapter) {
    return null;
  }

  return {
    chapter: { id: chapter.chapterId, slug: chapter.chapterSlug, title: chapter.chapterTitle },
    lesson: null,
  };
}
