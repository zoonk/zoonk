import { type CompletionInput } from "@zoonk/core/player/contracts/completion-input-schema";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { type PlayerAction, type PlayerState, playerReducer } from "./player-reducer";

/**
 * Captures the browser timezone when persistence starts so the server can
 * derive the completion date from its own clock.
 */
export function buildCompletionInput({
  state,
  timeZone = getLocalTimeZone(),
}: {
  state: PlayerState;
  timeZone?: string;
}): CompletionInput {
  return {
    answers: state.selectedAnswers,
    lessonId: state.lessonId,
    startedAt: state.startedAt,
    stepTimings: state.stepTimings,
    timeZone,
  };
}

export function getPlayerTransition(state: PlayerState, action: PlayerAction) {
  const nextState = playerReducer(state, action);

  return {
    nextState,
    shouldPersistCompletion: state.phase !== "completed" && nextState.phase === "completed",
  };
}
