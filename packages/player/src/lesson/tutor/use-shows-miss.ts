"use client";

import { useLessonPlayer } from "../lesson-player-context";

/**
 * A wrong answer's result is on screen, when the buddy helps most: it says its name in the bar,
 * and the aside offers its suggested questions. A guess is never wrong, so it doesn't count.
 */
export function useShowsMiss(): boolean {
  const { screen, state } = useLessonPlayer();
  const { step } = screen;
  const result = step ? state.results[step.id] : undefined;

  return state.phase === "feedback" && result?.isCorrect === false && step?.kind !== "hook";
}
