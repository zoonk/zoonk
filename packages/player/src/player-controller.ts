import { type CompletionInput } from "./completion-input-schema";
import { type PlayerAction, type PlayerState, playerReducer } from "./player-reducer";

function getLocalDate(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function buildCompletionInput(state: PlayerState, now: Date = new Date()): CompletionInput {
  return {
    activityId: state.activityId,
    answers: state.selectedAnswers,
    dimensions: state.dimensions,
    localDate: getLocalDate(now),
    startedAt: state.startedAt,
    stepTimings: state.stepTimings,
  };
}

export function getSubmitCompletionRequestId(state: PlayerState): number {
  return state.completionRequestId + 1;
}

export function getPlayerTransition(state: PlayerState, action: PlayerAction) {
  const nextState = playerReducer(state, action);

  return {
    nextState,
    shouldSubmitCompletion:
      state.phase !== "completed" &&
      nextState.phase === "completed" &&
      state.completion.status === "idle",
  };
}
