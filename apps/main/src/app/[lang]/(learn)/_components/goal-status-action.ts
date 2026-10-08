"use server";

import { goalUpdateInputSchema } from "@zoonk/core/goals/contract";
import { updateGoal } from "@zoonk/core/goals/update";
import { type GoalStatusOutcome } from "@zoonk/learn/journey";

/**
 * Pauses, resumes or archives a goal from its Journey or a paused Today. The status is
 * untrusted input, so it's parsed with the API's schema; core owns the goal's ownership and the
 * free plan's limit on active goals, which resuming can hit.
 */
export async function setGoalStatusAction(
  goalId: string,
  status: unknown,
): Promise<GoalStatusOutcome> {
  const input = goalUpdateInputSchema.safeParse({ status });

  if (!input.success) {
    return "failed";
  }

  const result = await updateGoal({ goalId, input: input.data });

  if (result.status === "limitReached") {
    return "limitReached";
  }

  return result.status === "updated" ? "saved" : "failed";
}
