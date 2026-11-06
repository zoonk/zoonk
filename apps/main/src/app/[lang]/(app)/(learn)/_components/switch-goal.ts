"use client";

import { getLearnerGeneration, mergeLearnerSummary } from "@/lib/learner/learner-store";
import { switchGoalAction } from "./switch-goal-action";

/**
 * Resolves to whether the goal is now the active one. The summary read after it is dropped if the
 * session changed hands while the switch was on its way.
 */
export async function switchGoal(goalId: string): Promise<boolean> {
  const generation = getLearnerGeneration();
  const summary = await switchGoalAction(goalId);
  mergeLearnerSummary({ generation, summary });
  return summary !== null;
}
