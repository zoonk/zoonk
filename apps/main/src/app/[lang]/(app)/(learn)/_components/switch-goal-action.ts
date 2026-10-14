"use server";

import { getLearnerSummary } from "@zoonk/core/learner/summary";
import { type LearnerSummary } from "@zoonk/core/learner/summary/contract";
import { updateLearningProfile } from "@zoonk/core/profile/update";

/**
 * Every tab reads the active goal, so saving it re-renders the tab the learner is on; the summary
 * read after it gives the frame (the switcher, the tabs, the sidebar) the new goal's day.
 */
export async function switchGoalAction(goalId: string): Promise<LearnerSummary | null> {
  await updateLearningProfile({ activeGoalId: goalId });
  return getLearnerSummary();
}
