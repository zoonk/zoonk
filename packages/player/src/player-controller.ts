import { type CompletionInput } from "@zoonk/core/player/contracts/completion-input-schema";
import { type PlayerAction, type PlayerState, playerReducer } from "./player-reducer";

function getLocalDate(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

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
