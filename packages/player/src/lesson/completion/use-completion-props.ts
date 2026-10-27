"use client";

import { type LessonCompletionSlotProps, useLessonPlayer } from "../lesson-player-context";

/**
 * What the completion moment and its header read once the lesson is done; null before. The score
 * counts the header's answered segments, including second tries. The server's first-answer tally
 * governs rewards and reviews, not this readout of the screens the learner just played.
 */
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
