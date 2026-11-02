"use client";

import { type LessonCompletionSlotProps, useLessonPlayer } from "../lesson-player-context";

export function useCompletionProps(): LessonCompletionSlotProps | null {
  const { actions, screen, state } = useLessonPlayer();
  const { completion } = state;

  if (state.phase !== "completed" || !completion || completion.status === "ready") {
    return null;
  }

  return {
    completion,
    correctCount: screen.segments.filter((segment) => segment === "right").length,
    incorrectCount: screen.segments.filter((segment) => segment === "wrong").length,
    onRetry: actions.retryCompletion,
  };
}
