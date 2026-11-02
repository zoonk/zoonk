import { type LessonPlayerState } from "../lesson-player-state";
import { type PlayableLibraryStep } from "../lesson-player-types";
import { enterPosition, leaveOutAhead } from "./lesson-flow";
import { isNumberAnswer } from "./number-answer";
import { showSampleAnswer } from "./sample-answer";

function isWritingStep(step: PlayableLibraryStep | undefined): boolean {
  return step?.kind === "typedAnswer" && !isNumberAnswer(step.content.acceptedAnswers);
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
