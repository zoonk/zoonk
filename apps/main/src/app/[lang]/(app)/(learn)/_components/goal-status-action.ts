"use server";

import { goalUpdateInputSchema } from "@zoonk/core/goals/contract";
import { updateGoal } from "@zoonk/core/goals/update";
import { getLearnerSummary } from "@zoonk/core/learner/summary";
import { type LearnerSummary } from "@zoonk/core/learner/summary/contract";
import { type GoalStatusOutcome } from "@zoonk/learn/journey";
import { retryGenerationAction } from "../../(onboarding)/start/onboarding-actions";

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

async function saveGoalUpdate(goalId: string, update: unknown): Promise<boolean> {
  const input = goalUpdateInputSchema.safeParse(update);

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
  return saveGoalUpdate(goalId, { targetRegion });
}

export async function applyGoalCountryAction(
  goalId: string,
  targetRegion: unknown,
): Promise<LearnerSummary | null> {
  return (await saveGoalUpdate(goalId, { targetRegion })) ? getLearnerSummary() : null;
}

/** Null goes back to the goal language's own country. */
export async function setGoalContentCountryAction(
  goalId: string,
  contentCountry: unknown,
): Promise<boolean> {
  return saveGoalUpdate(goalId, { contentCountry });
}

export async function applyGoalContentCountryAction(
  goalId: string,
  contentCountry: unknown,
): Promise<LearnerSummary | null> {
  return (await saveGoalUpdate(goalId, { contentCountry })) ? getLearnerSummary() : null;
}

/** Starts a failed rebuild again; the old plan stays until the new one saves. */
export async function retryGoalRebuildAction(goalId: string): Promise<boolean> {
  return (await retryGenerationAction(goalId)) !== null;
}

export async function renameGoalAction(goalId: string, displayName: unknown): Promise<boolean> {
  const input = goalUpdateInputSchema.safeParse({ displayName });

  if (!input.success) {
    return false;
  }

  const result = await updateGoal({ goalId, input: input.data });
  return result.status === "updated";
}
