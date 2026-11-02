"use server";

import { goalUpdateInputSchema } from "@zoonk/core/goals/contract";
import { updateGoal } from "@zoonk/core/goals/update";
import { type GoalStatusOutcome } from "@zoonk/learn/journey";

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
