"use client";

import { type LessonCompletionSlotProps, useLessonPlayer } from "../lesson-player-context";

/**
 * What the completion moment and its header read once the lesson is done; null before. The score
 * is the server's tally once the lesson is saved, since it's what counted.
 */
export function useCompletionProps(): LessonCompletionSlotProps | null {
  const { actions, state } = useLessonPlayer();
  const { completion } = state;

  if (state.phase !== "completed" || !completion || completion.status === "ready") {
    return null;
  }

  const verdicts = Object.values(state.firstVerdicts);

  return {
    completion,
    correctCount: completion.result?.correctCount ?? verdicts.filter(Boolean).length,
    incorrectCount:
      completion.result?.incorrectCount ?? verdicts.filter((isCorrect) => !isCorrect).length,
    onRetry: actions.retryCompletion,
  };
}
