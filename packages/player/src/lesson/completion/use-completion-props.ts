"use client";

import {
  type LessonCompletionSlotProps,
  useLessonPlayer,
  useLessonPlayerConfig,
} from "../lesson-player-context";

export function useCompletionProps(): LessonCompletionSlotProps | null {
  const { actions, screen, state } = useLessonPlayer();
  const { adapters } = useLessonPlayerConfig();
  const { completion } = state;
  const runId = state.run.status === "started" ? state.run.runId : null;

  if (state.phase !== "completed" || !completion || completion.status === "ready") {
    return null;
  }

  return {
    completion,
    correctCount: screen.segments.filter((segment) => segment === "right").length,
    incorrectCount: screen.segments.filter((segment) => segment === "wrong").length,
    onDismissOffer: async () => {
      const outcome = runId
        ? await adapters.completeLesson({ dismissPlacementOffer: true, runId })
        : null;

      return outcome?.status === "completed";
    },
    onRetry: actions.retryCompletion,
  };
}
