import {
  type NextActivityInCourse,
  getNextActivityInCourse,
} from "@zoonk/core/activities/next-in-course";
import { getNextActivityStateForUser } from "@zoonk/core/progress/next-activity-state";
import { type Chapter, type Lesson, prisma } from "@zoonk/db";
import { getNextSibling } from "../../progress/get-next-sibling";
import { type ContinueLearningRow } from "./continue-learning-queries";

export type ContinueLearningState = Awaited<ReturnType<typeof getNextActivityStateForUser>>;

type PendingTarget = {
  chapter: Pick<Chapter, "id" | "slug">;
  lesson: Pick<Lesson, "description" | "id" | "slug" | "title"> | null;
};

export type ContinueLearningCandidate = {
  isSequentialNextBlocked: boolean;
  pendingTarget: PendingTarget | null;
  row: ContinueLearningRow;
  sequentialNext: NextActivityInCourse | null;
  state: ContinueLearningState;
};

/**
 * The feed needs several derived signals per course anchor: the sequential
 * next activity, the durable-completion-aware next state, whether that
 * sequential target belongs to a durably completed chapter, and any pending
 * fallback destination. Loading all of that in one helper keeps the main feed
 * function focused on choosing the final card for each course.
 */
export async function listContinueLearningCandidates({
  rows,
  userId,
}: {
  rows: ContinueLearningRow[];
  userId: number;
}): Promise<ContinueLearningCandidate[]> {
  const [sequentialNextActivities, nextStates] = await Promise.all([
    listSequentialNextActivities({ rows }),
    listNextActivityStates({ rows, userId }),
  ]);

  const [blockedChapterIds, pendingTargets] = await Promise.all([
    listBlockedSequentialChapterIds({
      sequentialNextActivities,
      userId,
    }),
    listPendingTargets({
      rows,
      states: nextStates,
    }),
  ]);

  return rows.map((row, idx) => {
    const sequentialNext = sequentialNextActivities[idx] ?? null;

    return {
      isSequentialNextBlocked: sequentialNext
        ? blockedChapterIds.has(sequentialNext.chapterId)
        : false,
      pendingTarget: pendingTargets[idx] ?? null,
      row,
      sequentialNext,
      state: nextStates[idx] ?? null,
    };
  });
}

/**
 * The feed preserves the familiar "continue to the next activity" behavior by
 * first resolving the structural next activity after the learner's most recent
 * completion in each course.
 */
async function listSequentialNextActivities({ rows }: { rows: ContinueLearningRow[] }) {
  return Promise.all(
    rows.map((row) =>
      getNextActivityInCourse({
        activityPosition: row.activityPosition,
        chapterId: row.chapterId,
        chapterPosition: row.chapterPosition,
        courseId: row.courseId,
        lessonId: row.lessonId,
        lessonPosition: row.lessonPosition,
      }),
    ),
  );
}

/**
 * Durable completion can reopen the notion of "what is next" even when the
 * historical sequential target is no longer actionable. The shared next-state
 * helper keeps continue-learning aligned with catalog buttons and lesson pages.
 */
async function listNextActivityStates({
  rows,
  userId,
}: {
  rows: ContinueLearningRow[];
  userId: number;
}) {
  return Promise.all(
    rows.map((row) => getNextActivityStateForUser({ scope: { courseId: row.courseId }, userId })),
  );
}

/**
 * A sequential next activity should not win if it belongs to a chapter the
 * learner already completed durably. Loading those chapter completions in bulk
 * avoids one database query per course card.
 */
async function listBlockedSequentialChapterIds({
  sequentialNextActivities,
  userId,
}: {
  sequentialNextActivities: (NextActivityInCourse | null)[];
  userId: number;
}) {
  const chapterIds = [
    ...new Set(sequentialNextActivities.flatMap((next) => (next ? [next.chapterId] : []))),
  ];

  if (chapterIds.length === 0) {
    return new Set<number>();
  }

  const completions = await prisma.chapterCompletion.findMany({
    where: {
      chapterId: { in: chapterIds },
      userId,
    },
  });

  return new Set(completions.map((completion) => completion.chapterId));
}

/**
 * Once a course is still active but the shared next-state reports it as
 * completed, the feed needs a chapter-or-lesson shell target instead of an
 * activity deep link. This helper only resolves those fallback targets for the
 * rows that actually need them.
 */
async function listPendingTargets({
  rows,
  states,
}: {
  rows: ContinueLearningRow[];
  states: ContinueLearningState[];
}) {
  return Promise.all(
    rows.map((row, idx) => {
      const state = states[idx] ?? null;

      return shouldLoadPendingTarget({ state })
        ? findPendingTarget({ row })
        : Promise.resolve(null);
    }),
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
