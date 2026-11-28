import { type LessonPlayerState, isSkipNotice } from "../lesson-player-state";
import { type PlayableLibraryStep } from "../lesson-player-types";
import { enterPosition, leaveOutAhead, skipSteps } from "./lesson-flow";
import { isNumberAnswer } from "./number-answer";
import { showSampleAnswer } from "./sample-answer";

type SkipNotice = Extract<LessonPlayerState["notice"], "speakingSkipped" | "writingSkipped">;

type SkippedLists = Pick<LessonPlayerState, "skippedWritingStepIds" | "unavailableStepIds">;

function isWritingStep(step: PlayableLibraryStep | undefined): boolean {
  return step?.kind === "typedAnswer" && !isNumberAnswer(step.content.acceptedAnswers);
}

/** A second skip of the same kind on the same screen keeps the first one's restore, so one undo puts back both. */
function noteSkip(
  before: LessonPlayerState,
  after: LessonPlayerState,
  notice: SkipNotice,
): LessonPlayerState {
  if (after.phase !== "playing" || after.queue.length === before.queue.length) {
    return after;
  }

  const { position, queue, skippedWritingStepIds, unavailableStepIds } = before;
  const kept = before.notice === notice ? before.skipRestore : null;

  return {
    ...after,
    notice,
    skipRestore: kept ?? { position, queue, skippedWritingStepIds, unavailableStepIds },
  };
}

export function skipWriting(
  state: LessonPlayerState,
  { opening = false, stepId }: { opening?: boolean; stepId?: string } = {},
): LessonPlayerState {
  if (state.phase !== "playing") {
    return state;
  }

  if (stepId) {
    return showSampleAnswer(state, stepId);
  }

  const isLeftOut = (id: string) => isWritingStep(state.steps[id]);
  const skippedWritingStepIds = state.queue.slice(state.position).filter((id) => isLeftOut(id));

  const next = leaveOutAhead(
    {
      ...state,
      skippedWritingStepIds: [
        ...new Set([...state.skippedWritingStepIds, ...skippedWritingStepIds]),
      ],
    },
    isLeftOut,
    opening ? "ready" : "saving",
  );

  return noteSkip(state, next, "writingSkipped");
}

/** Speaking screens left out are this page's alone, like any screen the learner can't play here. */
export function skipSpeaking(
  state: LessonPlayerState,
  { opening = false, stepIds }: { opening?: boolean; stepIds: readonly string[] },
): LessonPlayerState {
  return noteSkip(
    state,
    skipSteps(state, stepIds, opening ? "ready" : "saving"),
    "speakingSkipped",
  );
}

/**
 * The lists from before the skip the notice names, and that skip, to make again on a lesson rebuilt
 * from the server. What was left out since for another reason, such as a dictation, stays out.
 */
export function undoSkip(
  state: LessonPlayerState,
): { lists: SkippedLists; redo: (next: LessonPlayerState) => LessonPlayerState } | null {
  const restore = state.skipRestore;

  if (!restore || !isSkipNotice(state.notice)) {
    return null;
  }

  if (state.notice === "writingSkipped") {
    return {
      lists: {
        skippedWritingStepIds: restore.skippedWritingStepIds,
        unavailableStepIds: state.unavailableStepIds,
      },
      redo: (next) => skipWriting(next, { opening: true }),
    };
  }

  const isSkipped = (id: string) =>
    !restore.unavailableStepIds.includes(id) && state.steps[id]?.kind === "spokenAnswer";

  const stepIds = state.unavailableStepIds.filter((id) => isSkipped(id));

  return {
    lists: {
      skippedWritingStepIds: state.skippedWritingStepIds,
      unavailableStepIds: state.unavailableStepIds.filter((id) => !isSkipped(id)),
    },
    redo: (next) => skipSpeaking(next, { opening: true, stepIds }),
  };
}

export function restoreSkipped(state: LessonPlayerState): LessonPlayerState {
  const undo = undoSkip(state);
  const restore = state.skipRestore;

  if (!undo || !restore || state.phase !== "playing") {
    return state;
  }

  const { unavailableStepIds } = undo.lists;

  const queue = restore.queue.filter(
    (id, index) => index < restore.position || !unavailableStepIds.includes(id),
  );

  return enterPosition({ ...state, ...undo.lists, queue, skipRestore: null }, restore.position);
}
