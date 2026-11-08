import { type LessonPlayerState } from "../lesson-player-state";

function complete(
  state: LessonPlayerState,
  status: "ready" | "saving" = "saving",
): LessonPlayerState {
  return {
    ...state,
    completion: { result: null, status, testedOut: state.quickCheck !== null },
    phase: "completed",
  };
}

/** Once every screen is done, the lesson map shows before the lesson saves, except after testing out. */
export function finishScreens(
  state: LessonPlayerState,
  status: "ready" | "saving" = "saving",
): LessonPlayerState {
  if (!state.hasMap || state.quickCheck) {
    return complete(state, status);
  }

  return {
    ...state,
    checkFailed: false,
    checkIssue: null,
    notice: null,
    phase: "map",
    position: Math.max(0, state.queue.length - 1),
    reviewing: false,
    stepStartedAt: Date.now(),
  };
}

export function leaveMap(state: LessonPlayerState): LessonPlayerState {
  return state.phase === "map" ? complete(state) : state;
}

export function isAtEnd(state: LessonPlayerState): boolean {
  return state.phase === "completed" || state.phase === "map";
}

export function setCompletionStatus(
  state: LessonPlayerState,
  status: "failed" | "saving",
): LessonPlayerState {
  return state.completion ? { ...state, completion: { ...state.completion, status } } : state;
}
