import { type CompletionResult } from "./completion-input-schema";
import { type PlayerState } from "./player-reducer";

export type PlayerCompletionState =
  | { status: "idle" }
  | { status: "submitting" }
  | CompletionResult;

export function createIdleCompletionState(): PlayerCompletionState {
  return { status: "idle" };
}

export function handleSubmitCompletion(state: PlayerState, requestId: number): PlayerState {
  return {
    ...state,
    completion: { status: "submitting" },
    completionRequestId: requestId,
  };
}

export function handleResolveCompletion(
  state: PlayerState,
  requestId: number,
  result: CompletionResult,
): PlayerState {
  if (requestId !== state.completionRequestId) {
    return state;
  }

  return {
    ...state,
    completion: result,
  };
}

export function handleRejectCompletion(state: PlayerState, requestId: number): PlayerState {
  if (requestId !== state.completionRequestId) {
    return state;
  }

  return {
    ...state,
    completion: { status: "error" },
  };
}
