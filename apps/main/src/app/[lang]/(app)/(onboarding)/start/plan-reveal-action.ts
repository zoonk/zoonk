"use server";

import { markPlanRevealed } from "@zoonk/core/goals/mark-plan-revealed";
import { isUuid } from "@zoonk/utils/uuid";

/** Expires the learner's goal reads, so the Today the browser kept is read again before it opens. */
export async function markPlanRevealedAction(goalId: string): Promise<boolean> {
  if (!isUuid(goalId)) {
    return false;
  }

  const result = await markPlanRevealed(goalId);
  return result.status === "ready";
}
