import { type LessonPlayerState } from "../lesson-player-state";
import { showPosition } from "./lesson-flow";

export function goBack(state: LessonPlayerState): LessonPlayerState {
  const position = state.phase === "map" ? state.position : state.position - 1;

  if (!canGoBack(state) || !state.queue[position]) {
    return state;
  }

  return showPosition(state, position);
}

/**
 * A missed question that came back holds its attempt in the later copy, so the earlier one, its
 * result cleared, would show it unanswered and let the learner answer it twice.
 */
function isEarlierCopy(state: LessonPlayerState, position: number): boolean {
  const id = state.queue[position] ?? "";
  return !(id in state.results) && state.queue.includes(id, position + 1);
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
    !isEarlierCopy(state, state.position - 1)
  );
}

