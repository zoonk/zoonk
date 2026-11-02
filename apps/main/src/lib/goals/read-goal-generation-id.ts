"use client";

import { getFromBrowser } from "@/lib/api/browser-api";
import { getString } from "@zoonk/utils/json";

/**
 * Reads the API, not a Server Action: Next.js sends actions one at a time to whichever page shows by
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
