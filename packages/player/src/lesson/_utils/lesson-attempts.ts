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

function showFirstAttempt(state: LessonPlayerState, id: string): LessonPlayerState {
  const first = state.firstAttempts[id];

  if (!first) {
    return state;
  }

  return {
    ...state,
    answers: first.answer
      ? { ...state.answers, [id]: first.answer }
      : omitKeys(state.answers, [id]),
    results: { ...state.results, [id]: first.result },
    rounds: { ...state.rounds, [id]: first.round },
  };
}

/** The state the screen at a position shows: an earlier copy of a question shows its own attempt. */
export function showAttemptAt(state: LessonPlayerState, position: number): LessonPlayerState {
  const id = state.queue[position] ?? "";
  return isEarlierCopy(state, position) ? showFirstAttempt(state, id) : state;
}

export function showAttemptInView(state: LessonPlayerState): LessonPlayerState {
  return showAttemptAt(state, state.position);
}
