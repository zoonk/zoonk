import { getNextChapterInCourse } from "@zoonk/core/lessons/next-chapter-in-course";
import { getNextLessonInCourse } from "@zoonk/core/lessons/next-in-course";
import { type Chapter, type Lesson } from "@zoonk/db";
import { type ContinueLearningState } from "./continue-learning-next-state";
import { type ContinueLearningRow } from "./continue-learning-queries";

export type PendingTarget = {
  chapter: Pick<Chapter, "id" | "slug" | "title">;
  lesson: Pick<Lesson, "description" | "id" | "kind" | "slug" | "title"> | null;
};

/**
 * Once a course is still active but the shared next-state reports it as
 * completed, the feed needs a chapter-or-lesson target instead of a completed
 * lesson deep link. This helper only resolves those fallback targets for the
 * rows that actually need them.
 */
export async function listPendingTargets({
  rows,
  states,
}: {
  rows: ContinueLearningRow[];
  states: ContinueLearningState[];
}) {
  return Promise.all(
    rows.map((row, idx) => listPendingTarget({ row, state: states[idx] ?? null })),
  );
}

/**
 * Pending fallback targets only matter when the shared next-state says the
 * course is complete for now but not durably completed overall. Every other
 * state can be rendered directly from the current lesson data.
 */
function shouldLoadPendingTarget({ state }: { state: ContinueLearningState }) {
  return Boolean(state?.completed && !state.scopeDurablyCompleted);
}

/**
 * This tiny orchestration helper keeps the Promise.all callback declarative and
 * avoids embedding branching logic directly inside the array mapping step.
 */
async function listPendingTarget({
  row,
  state,
}: {
  row: ContinueLearningRow;
  state: ContinueLearningState;
}) {
  if (!shouldLoadPendingTarget({ state })) {
    return null;
  }

  return findPendingTarget({ row });
}

/**
 * When a course has no actionable next lesson, the feed should still point
 * the learner to the next lesson player if one exists, otherwise to the next
 * chapter. That keeps the card useful even while generation is pending.
 */
async function findPendingTarget({
  row,
}: {
  row: ContinueLearningRow;
}): Promise<PendingTarget | null> {
  const nextLesson = await getNextLessonInCourse({
    chapterId: row.chapterId,
    chapterPosition: row.chapterPosition,
    courseId: row.courseId,
    lessonPosition: row.lessonPosition,
  });

  if (nextLesson) {
    return {
      chapter: {
        id: nextLesson.chapterId,
        slug: nextLesson.chapterSlug,
        title: nextLesson.chapterTitle,
      },
      lesson: {
        description: nextLesson.lessonDescription,
        id: nextLesson.lessonId,
        kind: nextLesson.lessonKind,
        slug: nextLesson.lessonSlug,
        title: nextLesson.lessonTitle,
      },
    };
  }

  const nextChapter = await getNextChapterInCourse({
    chapterPosition: row.chapterPosition,
    courseId: row.courseId,
  });

  if (!nextChapter) {
    return null;
  }

  return {
    chapter: {
      id: nextChapter.chapterId,
      slug: nextChapter.chapterSlug,
      title: nextChapter.chapterTitle,
    },
    lesson: null,
  };
}
