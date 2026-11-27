import "server-only";
import { getLearnerSummary } from "@zoonk/core/learner/summary";

/** The frame's summary, read once for the request, already says it for the active goal. */
export async function hasSavedLessons(goalId: string): Promise<boolean> {
  const summary = await getLearnerSummary();
  return summary?.activeGoalId === goalId && summary.places.savedLessons;
}
