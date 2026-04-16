import {
  type NextActivityInCourse,
  getNextActivityInCourse,
} from "@zoonk/core/activities/next-in-course";
import { prisma } from "@zoonk/db";
import { type ContinueLearningState, listNextActivityStates } from "./continue-learning-next-state";
import { type PendingTarget, listPendingTargets } from "./continue-learning-pending-targets";
import { type ContinueLearningRow } from "./continue-learning-queries";

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
  userId: string;
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
 * A structural sequential target only makes sense while that lesson and chapter
 * are still genuinely open for the learner. Once either scope has durable
 * completion, the shared next-state is the more trustworthy source of truth.
 */
async function listBlockedSequentialTargetIds({
  sequentialNextActivities,
  userId,
}: {
  sequentialNextActivities: (NextActivityInCourse | null)[];
  userId: string;
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
  return { chapterIds: new Set<number>(), lessonIds: new Set<number>() };
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
  userId: string;
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
  userId: string;
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
