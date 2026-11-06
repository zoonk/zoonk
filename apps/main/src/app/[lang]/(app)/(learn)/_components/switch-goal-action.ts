"use server";

import { getLearnerSummary } from "@zoonk/core/learner/summary";
import { type LearnerSummary } from "@zoonk/core/learner/summary/contract";
import { updateLearningProfile } from "@zoonk/core/profile/update";

/** Null when the goal didn't become the active one, such as one archived on another device. */
export async function switchGoalAction(goalId: string): Promise<LearnerSummary | null> {
  const updated = await updateLearningProfile({ activeGoalId: goalId });
  return updated.status === "updated" ? getLearnerSummary() : null;
}
