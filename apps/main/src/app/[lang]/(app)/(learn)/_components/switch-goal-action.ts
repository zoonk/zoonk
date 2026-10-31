"use server";

import { getLearnerSummary } from "@zoonk/core/learner/summary";
import { type LearnerSummary } from "@zoonk/core/learner/summary/contract";
import { updateLearningProfile } from "@zoonk/core/profile/update";

export async function switchGoalAction(goalId: string): Promise<LearnerSummary | null> {
  await updateLearningProfile({ activeGoalId: goalId });
  return getLearnerSummary();
}
