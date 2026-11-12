"use server";

import { goalUpdateInputSchema } from "@zoonk/core/goals/contract";
import { updateGoal } from "@zoonk/core/goals/update";
import { getLearnerSummary } from "@zoonk/core/learner/summary";
import { type LearnerSummary } from "@zoonk/core/learner/summary/contract";
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

async function saveGoalCountry(goalId: string, targetRegion: unknown): Promise<boolean> {
  const input = goalUpdateInputSchema.safeParse({ targetRegion });

  if (!input.success) {
    return false;
  }

  const result = await updateGoal({ goalId, input: input.data });
  return result.status === "updated";
}

export async function setGoalCountryAction(
  goalId: string,
  targetRegion: unknown,
): Promise<boolean> {
  return saveGoalCountry(goalId, targetRegion);
}

export async function applyGoalCountryAction(
  goalId: string,
  targetRegion: unknown,
): Promise<LearnerSummary | null> {
  return (await saveGoalCountry(goalId, targetRegion)) ? getLearnerSummary() : null;
}

export async function renameGoalAction(goalId: string, displayName: unknown): Promise<boolean> {
  const input = goalUpdateInputSchema.safeParse({ displayName });

  if (!input.success) {
    return false;
  }

  const result = await updateGoal({ goalId, input: input.data });
  return result.status === "updated";
}
