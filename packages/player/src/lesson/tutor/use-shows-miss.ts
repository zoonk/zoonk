"use client";

import { useLessonPlayer } from "../lesson-player-context";

export function useShowsMiss(): boolean {
  const { screen, state } = useLessonPlayer();
  const { step } = screen;
  const result = step ? state.results[step.id] : undefined;

  return state.phase === "feedback" && result?.isCorrect === false && step?.kind !== "hook";
}
