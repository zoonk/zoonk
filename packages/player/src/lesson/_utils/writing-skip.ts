import { type LessonPlayerState } from "../lesson-player-state";
import { type PlayableLibraryStep } from "../lesson-player-types";
import { enterPosition, leaveOutAhead } from "./lesson-flow";
import { isNumberAnswer } from "./number-answer";
import { showSampleAnswer } from "./sample-answer";

/** A written answer; a number typed into a number field is a calculation's answer instead. */
function isWritingStep(step: PlayableLibraryStep | undefined): boolean {
  return step?.kind === "typedAnswer" && !isNumberAnswer(step.content.acceptedAnswers);
}

/**
 * Leaves writing out of this run, with no answer verdict: the screen in view, which the learner
 * doesn't know yet, once its sample answer is read (`stepId`), or all of it from here on ("Can't
 * write now", tapped here, or earlier today as the lesson opens), number questions kept. The screen
 * that takes the place of all of it says so, so the learner knows one tap covered the whole
 * lesson, and keeps the lesson as it was for "Write again". A lesson left with nothing to do as it
 * opens (`opening`) waits for Finish, since only a learner's action saves one.
 */
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

  if (next.phase !== "playing" || skippedWritingStepIds.length === 0) {
    return next;
  }

  const { position, queue } = state;

  return {
    ...next,
    notice: "writingSkipped",
    writingRestore: { position, queue, skippedWritingStepIds: state.skippedWritingStepIds },
  };
}

/**
 * "Write again" on the screen that says the writing was left out: the lesson goes back to how it
 * was, the screen the learner left with "Can't write now" included. Once they moved on or answered
 * there, it can't.
 */
export function restoreWriting(state: LessonPlayerState): LessonPlayerState {
  const restore = state.writingRestore;

  if (!restore || state.notice !== "writingSkipped" || state.phase !== "playing") {
    return state;
  }

  return enterPosition(
    {
      ...state,
      notice: null,
      queue: restore.queue,
      skippedWritingStepIds: restore.skippedWritingStepIds,
      writingRestore: null,
    },
    restore.position,
  );
}
