"use client";

import { getLearnerGeneration, mergeLearnerSummary } from "@/lib/learner/learner-store";
import { switchGoalAction } from "./switch-goal-action";

/** The summary read after it is dropped if the session changed hands while the switch was on its way. */
export async function switchGoal(goalId: string): Promise<void> {
  const generation = getLearnerGeneration();
  mergeLearnerSummary({ generation, summary: await switchGoalAction(goalId) });
}
