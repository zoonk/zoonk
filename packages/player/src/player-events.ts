import { type PlayerState } from "./player-reducer";

export type PlayerStepChangeEvent = {
  direction: "next" | "prev";
  lessonId: string;
  nextStepId: string;
  nextStepIndex: number;
  previousStepId: string;
  previousStepIndex: number;
};

/**
 * Host apps sometimes need to react to real player progress without depending
 * on reducer internals. This converts a before/after reducer pair into a small
 * semantic event and ignores terminal transitions where there is no next step.
 */
export function getPlayerStepChangeEvent({
  nextState,
  state,
}: {
  nextState: PlayerState;
  state: PlayerState;
}): PlayerStepChangeEvent | null {
  if (state.currentStepIndex === nextState.currentStepIndex || nextState.phase !== "playing") {
    return null;
  }

  const previousStep = state.steps[state.currentStepIndex];
  const nextStep = nextState.steps[nextState.currentStepIndex];

  if (!previousStep || !nextStep) {
    return null;
  }

  return {
    direction: nextState.currentStepIndex > state.currentStepIndex ? "next" : "prev",
    lessonId: state.lessonId,
    nextStepId: nextStep.id,
    nextStepIndex: nextState.currentStepIndex,
    previousStepId: previousStep.id,
    previousStepIndex: state.currentStepIndex,
  };
}
