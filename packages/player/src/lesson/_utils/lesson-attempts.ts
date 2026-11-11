import { type LessonPlayerState } from "../lesson-player-state";
import { omitKeys } from "./records";

function isEarlierCopy(state: LessonPlayerState, position: number): boolean {
  return state.queue.includes(state.queue[position] ?? "", position + 1);
}

/**
 * A missed question that came back keeps its first attempt for its earlier copy, after its retry
 * started over.
 */
export function hasAttemptAt(state: LessonPlayerState, position: number): boolean {
  const id = state.queue[position] ?? "";
  return id in state.results || (id in state.firstAttempts && isEarlierCopy(state, position));
}

/** The state the screen in view shows: an earlier copy of a question shows its own attempt. */
export function showAttemptInView(state: LessonPlayerState): LessonPlayerState {
  const id = state.queue[state.position] ?? "";
  const first = state.firstAttempts[id];

  if (!first || !isEarlierCopy(state, state.position)) {
    return state;
  }

  return {
    ...state,
    answers: first.answer ? { ...state.answers, [id]: first.answer } : omitKeys(state.answers, [id]),
    results: { ...state.results, [id]: first.result },
    rounds: { ...state.rounds, [id]: first.round },
  };
}
