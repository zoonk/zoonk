"use client";

import { getFromBrowser } from "@/lib/api/browser-api";
import { getString } from "@zoonk/utils/json";

/**
 * The run writing the goal's curriculum, for a wait that opened before the goal had one (its start
 * failed, or its answer was lost). The wait asks every 2 s, so it reads the API instead of a Server
 * Action: Next.js sends those one at a time, after the learner's own, to whichever page shows by
 * then, and a page the learner moved on to can't run it. Null when it couldn't be read.
 */
export async function readGoalGenerationId(goalId: string): Promise<string | null> {
  const response = await getFromBrowser(`/v1/goals/${encodeURIComponent(goalId)}/generations`);

  if (!response?.ok) {
    return null;
  }

  const body: unknown = await response.json().catch(() => null);
  return getString(body, "generationId");
}
