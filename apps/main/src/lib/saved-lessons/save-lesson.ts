"use client";

import { postFromBrowser } from "@/lib/api/browser-api";
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

export function saveLessonIn(goalId: string): SaveLesson {
  return (input) => saveLesson({ goalId, input });
}
