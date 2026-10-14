"use server";

import { updateLearningProfile } from "@zoonk/core/profile/update";

/** Every tab reads the active goal, so saving it re-renders the tab the learner is on. */
export async function switchGoalAction(goalId: string): Promise<void> {
  await updateLearningProfile({ activeGoalId: goalId });
}
