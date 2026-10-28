"use server";

import { startGoalWork } from "@/lib/goals/start-goal-work";
import { getExplanation } from "@zoonk/core/view-models/explain/get";
import { isUuid } from "@zoonk/utils/uuid";

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
