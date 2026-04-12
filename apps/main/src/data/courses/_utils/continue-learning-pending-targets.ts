import { getNextSibling } from "@zoonk/core/player/queries/get-next-sibling";
import { type Chapter, type Lesson } from "@zoonk/db";
import { type ContinueLearningState } from "./continue-learning-next-state";
import { type ContinueLearningRow } from "./continue-learning-queries";

export type PendingTarget = {
  chapter: Pick<Chapter, "id" | "slug">;
  lesson: Pick<Lesson, "description" | "id" | "slug" | "title"> | null;
};

/**
 * Once a course is still active but the shared next-state reports it as
 * completed, the feed needs a chapter-or-lesson shell target instead of an
 * activity deep link. This helper only resolves those fallback targets for the
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
    rows.map((row, idx) =>
      listPendingTarget({
        row,
        state: states[idx] ?? null,
      }),
    ),
  );
}

/**
 * Pending fallback targets only matter when the shared next-state says the
 * course is complete for now but not durably completed overall. Every other
 * state can be rendered directly from the current activity or lesson data.
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
 * When a course has no actionable next activity, the feed should still point
 * the learner to the next lesson shell if one exists, otherwise to the next
 * chapter shell. That keeps the card useful even while generation is pending.
 */
async function findPendingTarget({
  row,
}: {
  row: ContinueLearningRow;
}): Promise<PendingTarget | null> {
  const nextLesson = await getNextSibling({
    chapterId: row.chapterId,
    chapterPosition: row.chapterPosition,
    courseId: row.courseId,
    lessonPosition: row.lessonPosition,
    level: "lesson",
  });

  if (nextLesson) {
    return {
      chapter: { id: nextLesson.chapterId, slug: nextLesson.chapterSlug },
      lesson: {
        description: nextLesson.lessonDescription,
        id: nextLesson.lessonId,
        slug: nextLesson.lessonSlug,
        title: nextLesson.lessonTitle,
      },
    };
  }

  const nextChapter = await getNextSibling({
    chapterPosition: row.chapterPosition,
    courseId: row.courseId,
    level: "chapter",
  });

  if (!nextChapter) {
    return null;
  }

  return {
    chapter: { id: nextChapter.chapterId, slug: nextChapter.chapterSlug },
    lesson: null,
  };
}
