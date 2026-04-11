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

type BlockedSequentialTargetIds = {
  chapterIds: Set<number>;
  lessonIds: Set<number>;
};

type SequentialTargetIds = {
  chapterIds: number[];
  lessonIds: number[];
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

  const [blockedSequentialTargetIds, pendingTargets] = await Promise.all([
    listBlockedSequentialTargetIds({
      sequentialNextActivities,
      userId,
    }),
    listPendingTargets({
      rows,
      states: nextStates,
    }),
  ]);

  return rows.map((row, idx) =>
    toContinueLearningCandidate({
      blockedSequentialTargetIds,
      pendingTarget: pendingTargets[idx] ?? null,
      row,
      sequentialNext: sequentialNextActivities[idx] ?? null,
      state: nextStates[idx] ?? null,
    }),
  );
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
 * Candidate assembly is a pure merge of already-loaded signals. Keeping this
 * object construction in one place avoids rebuilding the same blocked-state
 * logic inline inside the main list loader.
 */
function toContinueLearningCandidate(input: {
  blockedSequentialTargetIds: BlockedSequentialTargetIds;
  pendingTarget: PendingTarget | null;
  row: ContinueLearningRow;
  sequentialNext: NextActivityInCourse | null;
  state: ContinueLearningState;
}): ContinueLearningCandidate {
  return {
    isSequentialNextBlocked: isSequentialTargetBlocked({
      blockedSequentialTargetIds: input.blockedSequentialTargetIds,
      sequentialNext: input.sequentialNext,
    }),
    pendingTarget: input.pendingTarget,
    row: input.row,
    sequentialNext: input.sequentialNext,
    state: input.state,
  };
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
 * A structural sequential target only makes sense while that lesson and chapter
 * are still genuinely open for the learner. Once either scope has durable
 * completion, the shared next-state is the more trustworthy source of truth.
 */
async function listBlockedSequentialTargetIds({
  sequentialNextActivities,
  userId,
}: {
  sequentialNextActivities: (NextActivityInCourse | null)[];
  userId: number;
}): Promise<BlockedSequentialTargetIds> {
  const targetIds = getSequentialTargetIds({ sequentialNextActivities });

  if (hasNoSequentialTargetIds({ targetIds })) {
    return getEmptyBlockedSequentialTargetIds();
  }

  const [chapterCompletions, lessonCompletions] = await Promise.all([
    listBlockedSequentialChapterIds({
      chapterIds: targetIds.chapterIds,
      userId,
    }),
    listBlockedSequentialLessonIds({
      lessonIds: targetIds.lessonIds,
      userId,
    }),
  ]);

  return {
    chapterIds: toBlockedChapterIdSet({ chapterCompletions }),
    lessonIds: toBlockedLessonIdSet({ lessonCompletions }),
  };
}

/**
 * Sequential navigation only cares about ids from real next targets. Extracting
 * them once up front keeps the completion queries small and makes the blocking
 * rule easier to read.
 */
function getSequentialTargetIds({
  sequentialNextActivities,
}: {
  sequentialNextActivities: (NextActivityInCourse | null)[];
}): SequentialTargetIds {
  return {
    chapterIds: getUniqueSequentialChapterIds({ sequentialNextActivities }),
    lessonIds: getUniqueSequentialLessonIds({ sequentialNextActivities }),
  };
}

/**
 * Chapter-level durable completion should prevent a sequential activity from
 * reopening content inside that chapter.
 */
function getUniqueSequentialChapterIds({
  sequentialNextActivities,
}: {
  sequentialNextActivities: (NextActivityInCourse | null)[];
}) {
  return [...new Set(sequentialNextActivities.flatMap((next) => (next ? [next.chapterId] : [])))];
}

/**
 * Lesson-level durable completion is the new guard for regenerated lessons
 * that gained more current activities after the learner already finished them.
 */
function getUniqueSequentialLessonIds({
  sequentialNextActivities,
}: {
  sequentialNextActivities: (NextActivityInCourse | null)[];
}) {
  return [...new Set(sequentialNextActivities.flatMap((next) => (next ? [next.lessonId] : [])))];
}

/**
 * The loader can skip all durable-completion queries when there are no
 * sequential targets at all.
 */
function hasNoSequentialTargetIds({ targetIds }: { targetIds: SequentialTargetIds }) {
  return targetIds.chapterIds.length === 0 && targetIds.lessonIds.length === 0;
}

/**
 * Returning the same empty shape keeps the no-target branch obvious and avoids
 * inline object literals inside the main query helper.
 */
function getEmptyBlockedSequentialTargetIds(): BlockedSequentialTargetIds {
  return {
    chapterIds: new Set<number>(),
    lessonIds: new Set<number>(),
  };
}

/**
 * Chapter completions are loaded in bulk so continue-learning does not need
 * one database query per course card.
 */
async function listBlockedSequentialChapterIds({
  chapterIds,
  userId,
}: {
  chapterIds: number[];
  userId: number;
}) {
  if (chapterIds.length === 0) {
    return [];
  }

  return prisma.chapterCompletion.findMany({
    where: {
      chapterId: { in: chapterIds },
      userId,
    },
  });
}

/**
 * Lesson completions are loaded alongside chapter completions so regenerated
 * lessons that are already durably completed do not win the sequential branch.
 */
async function listBlockedSequentialLessonIds({
  lessonIds,
  userId,
}: {
  lessonIds: number[];
  userId: number;
}) {
  if (lessonIds.length === 0) {
    return [];
  }

  return prisma.lessonCompletion.findMany({
    where: {
      lessonId: { in: lessonIds },
      userId,
    },
  });
}

/**
 * Converting rows to sets in dedicated helpers keeps the main bulk loader
 * focused on orchestration instead of low-level collection details.
 */
function toBlockedChapterIdSet({
  chapterCompletions,
}: {
  chapterCompletions: { chapterId: number }[];
}) {
  return new Set(chapterCompletions.map((completion) => completion.chapterId));
}

/**
 * Lesson completion is stored separately from raw activity progress, so this
 * helper turns the bulk query rows into a fast membership check.
 */
function toBlockedLessonIdSet({
  lessonCompletions,
}: {
  lessonCompletions: { lessonId: number }[];
}) {
  return new Set(lessonCompletions.map((completion) => completion.lessonId));
}

/**
 * A sequential target is only valid when both its lesson and chapter are still
 * open for the learner. Otherwise continue-learning should trust the shared
 * durable-aware next-state instead.
 */
function isSequentialTargetBlocked({
  blockedSequentialTargetIds,
  sequentialNext,
}: {
  blockedSequentialTargetIds: BlockedSequentialTargetIds;
  sequentialNext: NextActivityInCourse | null;
}) {
  if (!sequentialNext) {
    return false;
  }

  return (
    blockedSequentialTargetIds.chapterIds.has(sequentialNext.chapterId) ||
    blockedSequentialTargetIds.lessonIds.has(sequentialNext.lessonId)
  );
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
