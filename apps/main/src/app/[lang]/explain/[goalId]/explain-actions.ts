"use server";

import { startGoalWork } from "@/lib/goals/start-goal-work";
import { getExplanation } from "@zoonk/core/view-models/explain/get";
import { isUuid } from "@zoonk/utils/uuid";

/**
 * Asks again for an explanation that's slow to start. Only the learner's own question counts. Says
 * whether it's being written now (the run already going joined, or a new one started) or written
 * already: false when the API refused or couldn't be reached, so the learner can ask again.
 */
export async function retryExplanationAction(goalId: string): Promise<boolean> {
  if (!isUuid(goalId)) {
    return false;
  }

  const result = await getExplanation({ goalId });

  if (result.status !== "ready") {
    return false;
  }

  if (result.explanation.status !== "preparing") {
    return true;
  }

  const [started] = await startGoalWork([{ id: goalId, kind: "explain" }]);
  return Boolean(started?.generationId);
}
