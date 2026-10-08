"use server";

import { startGoalWork } from "@/lib/goals/start-goal-work";
import { getExplanation } from "@zoonk/core/view-models/explain/get";
import { isUuid } from "@zoonk/utils/uuid";

/** Asks again for an explanation that's slow to start. Only the learner's own question counts. */
export async function retryExplanationAction(goalId: string): Promise<void> {
  if (!isUuid(goalId)) {
    return;
  }

  const result = await getExplanation({ goalId });

  if (result.status === "ready" && result.explanation.status === "preparing") {
    await startGoalWork([{ id: goalId, kind: "explain" }]);
  }
}
