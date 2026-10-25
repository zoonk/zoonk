"use client";

import { useCallback, useState } from "react";

/**
 * Where the conversation shows: a drawer over the task on phones and tablets in portrait, or
 * docked in the task's aside from `lg`, beside what it's about. Chosen when it opens.
 */
export type TutorPresentation = "dock" | "drawer";

/** How the conversation shows (null: it doesn't) on a visit. */
type ShownConversation = { presentation: TutorPresentation | null; visit: string };

/**
 * The conversation shows on the visit the learner opened it on (a lesson's screen or a run's
 * question, by its place in the lesson or run), until they move to another one: a question never
 * opens with a conversation the learner didn't open on it, so a missed one coming back opens
 * fresh. Back on it, asking or opening the buddy shows the conversation again.
 */
export function useShownConversation(visit: string) {
  const [shown, setShown] = useState<ShownConversation>({ presentation: null, visit });

  if (shown.visit !== visit) {
    setShown({ presentation: null, visit });
  }

  const show = useCallback(
    (presentation: TutorPresentation) => setShown({ presentation, visit }),
    [visit],
  );

  return { presentation: shown.visit === visit ? shown.presentation : null, show };
}
