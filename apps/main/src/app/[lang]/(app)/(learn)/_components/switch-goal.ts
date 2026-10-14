"use client";

import { getLearnerGeneration, mergeLearnerSummary } from "@/lib/learner/learner-store";
import { switchGoalAction } from "./switch-goal-action";

/**
 * Saves the goal the learner switched to (from the switcher or the palette) and takes the summary
 * read after it, so the frame shows the new goal as the page re-renders with it, unless the
 * session changed hands while the switch was on its way.
 */
export async function switchGoal(goalId: string): Promise<void> {
  const generation = getLearnerGeneration();
  mergeLearnerSummary({ generation, summary: await switchGoalAction(goalId) });
}
