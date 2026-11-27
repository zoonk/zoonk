"use client";

import { postFromBrowser } from "@/lib/api/browser-api";
import { getLearnerSummaryState, readLearnerSummaryAgain } from "@/lib/learner/learner-store";
import { type SaveLessonInput, saveLessonSchema } from "@zoonk/core/saved-lessons/contract";
import { type SaveLesson } from "@zoonk/learn/saved-lessons/saves";

/**
 * From the browser, as a map's save is: a Server Action would expire the learner's tags and render
 * again the screen it's on, a lesson's player included.
 */
async function saveLesson({
  goalId,
  input,
}: {
  goalId: string;
  input: SaveLessonInput;
}): Promise<boolean | null> {
  const response = await postFromBrowser({
    body: input,
    path: `/v1/goals/${encodeURIComponent(goalId)}/saved-lessons`,
  });

  if (!response?.ok) {
    return null;
  }

  const json: unknown = await response.json().catch(() => null);
  return saveLessonSchema.safeParse(json).data?.saved ?? null;
}

/** The first save adds Saved lessons to the frame's places, and the last removal takes it away. */
function readPlacesAfterSave(saved: boolean): void {
  const state = getLearnerSummaryState();

  if (!saved || state.status !== "ready" || !state.summary.places.savedLessons) {
    readLearnerSummaryAgain();
  }
}

/** `onSaved` defaults to reading the frame's places again at once. */
export function saveLessonIn(
  goalId: string,
  onSaved: (saved: boolean) => void = readPlacesAfterSave,
): SaveLesson {
  return async (input) => {
    const saved = await saveLesson({ goalId, input });

    if (saved !== null) {
      onSaved(saved);
    }

    return saved;
  };
}
