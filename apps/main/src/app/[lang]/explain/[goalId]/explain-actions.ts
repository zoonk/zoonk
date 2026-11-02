"use server";

import { postAsLearner } from "@/lib/api/learner-api";
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

  const response = await postAsLearner({
    path: `/v1/goals/${encodeURIComponent(goalId)}/generations`,
  });

  return response.ok;
}
