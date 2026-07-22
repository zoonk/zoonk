import { type NextLessonInCourse } from "@zoonk/core/lessons/next-in-course";
import { type LessonKind } from "@zoonk/db";
import {
  type ContinueLearningProgressState,
  type ContinueLearningState,
  listNextLessonStates,
} from "./continue-learning-next-state";
import { type PendingTarget, getPendingTarget } from "./continue-learning-pending-targets";
import { type ContinueLearningRow } from "./continue-learning-queries";

export type ContinueLearningCandidate = {
  isSequentialNextBlocked: boolean;
  pendingTarget: PendingTarget | null;
  row: ContinueLearningRow;
  sequentialNext: NextLessonInCourse | null;
  state: ContinueLearningState;
};

/** Compares structural positions even when the historical lesson is no longer published. */
function isAfterCompletionAnchor({
  candidate,
  row,
}: {
  candidate: ContinueLearningProgressState["rows"][number];
  row: ContinueLearningRow;
}) {
  return (
    candidate.chapterPosition > row.chapterPosition ||
    (candidate.chapterPosition === row.chapterPosition &&
      candidate.lessonPosition > row.lessonPosition)
  );
}

/** Finds the first current curriculum row after the historical completion anchor. */
function getSequentialNextLesson({
  progressState,
  row,
}: {
  progressState: ContinueLearningProgressState;
  row: ContinueLearningRow;
}): NextLessonInCourse | null {
  const nextRow = progressState.rows.find((candidate) =>
    isAfterCompletionAnchor({ candidate, row }),
  );

  if (!nextRow) {
    return null;
  }

  return {
    chapterId: nextRow.chapterId,
    chapterPosition: nextRow.chapterPosition,
    chapterSlug: nextRow.chapterSlug,
    chapterTitle: nextRow.chapterTitle,
    lessonDescription: nextRow.lessonDescription,
    lessonGenerationStatus: nextRow.lessonGenerationStatus,
    lessonId: nextRow.lessonId,
    lessonKind: nextRow.lessonKind,
    lessonPosition: nextRow.lessonPosition,
    lessonSlug: nextRow.lessonSlug,
    lessonTitle: nextRow.lessonTitle,
  };
}

/**
 * Durable completion prevents a structural next lesson from reopening content
 * the learner has already earned. Those ids come from the same progress-state
 * leaves, so no second completion query is necessary.
 */
function isSequentialTargetBlocked({
  progressState,
  sequentialNext,
}: {
  progressState: ContinueLearningProgressState;
  sequentialNext: NextLessonInCourse | null;
}) {
  if (!sequentialNext) {
    return false;
  }

  return (
    progressState.durableChapterCompletionIds.includes(sequentialNext.chapterId) ||
    progressState.rows.some(
      (row) => row.lessonId === sequentialNext.lessonId && row.completedLessons > 0,
    )
  );
}

/**
 * Merges already loaded structural and learner state into the one shape used by
 * the feed item selector. No database work occurs during this assembly pass.
 */
function toContinueLearningCandidate({
  progressState,
  row,
}: {
  progressState: ContinueLearningProgressState;
  row: ContinueLearningRow;
}): ContinueLearningCandidate {
  const sequentialNext = getSequentialNextLesson({ progressState, row });

  return {
    isSequentialNextBlocked: isSequentialTargetBlocked({ progressState, sequentialNext }),
    pendingTarget: getPendingTarget({ progressState, row }),
    row,
    sequentialNext,
    state: progressState.state,
  };
}

/**
 * Candidate state is loaded from the same input rows, so a missing indexed
 * result indicates an orchestration bug rather than an empty learner state.
 */
function getRequiredProgressState({
  index,
  progressStates,
}: {
  index: number;
  progressStates: ContinueLearningProgressState[];
}) {
  const progressState = progressStates[index];

  if (!progressState) {
    throw new Error("Missing continue-learning progress state");
  }

  return progressState;
}

/**
 * Loads durable-aware state once, then derives every structural target from
 * those ordered rows without issuing a second lesson query per course.
 */
export async function listContinueLearningCandidates({
  excludedLessonKinds,
  rows,
}: {
  excludedLessonKinds?: LessonKind[];
  rows: ContinueLearningRow[];
}): Promise<ContinueLearningCandidate[]> {
  const progressStates = await listNextLessonStates({ excludedLessonKinds, rows });

  return rows.map((row, index) =>
    toContinueLearningCandidate({
      progressState: getRequiredProgressState({ index, progressStates }),
      row,
    }),
  );
}
