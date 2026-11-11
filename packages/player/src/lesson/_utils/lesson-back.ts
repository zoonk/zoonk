import { type LessonPlayerState } from "../lesson-player-state";
import { hasAttemptAt } from "./lesson-attempts";
import { showPosition } from "./lesson-flow";

export function goBack(state: LessonPlayerState): LessonPlayerState {
  const position = state.phase === "map" ? state.position : state.position - 1;

  if (!canGoBack(state) || !state.queue[position]) {
    return state;
  }

  return showPosition(state, position);
}

/** An earlier copy of a question with no attempt to show would ask it again, which its retry does. */
function isUnansweredEarlierCopy(state: LessonPlayerState, position: number): boolean {
  const id = state.queue[position] ?? "";
  return state.queue.includes(id, position + 1) && !hasAttemptAt(state, position);
}

export function canGoBack(state: LessonPlayerState): boolean {
  if (state.run.status === "refused") {
    return false;
  }

  if (state.phase === "map") {
    return true;
  }

  return (
    (state.phase === "playing" || state.phase === "feedback") &&
    state.position > 0 &&
    !state.quickCheck &&
    !isUnansweredEarlierCopy(state, state.position - 1)
  );
}
