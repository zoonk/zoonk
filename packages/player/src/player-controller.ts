import { type CompletionInput } from "@zoonk/core/player/contracts/completion-input-schema";
import { getLocalDate } from "./player-date";
import { type PlayerAction, type PlayerState, playerReducer } from "./player-reducer";

export function buildCompletionInput(state: PlayerState, now: Date = new Date()): CompletionInput {
  return {
    answers: state.selectedAnswers,
    lessonId: state.lessonId,
    localDate: getLocalDate(now),
    startedAt: state.startedAt,
    stepTimings: state.stepTimings,
  };
}

export function getPlayerTransition(state: PlayerState, action: PlayerAction) {
  const nextState = playerReducer(state, action);

  return {
    nextState,
    shouldPersistCompletion: state.phase !== "completed" && nextState.phase === "completed",
  };
}
