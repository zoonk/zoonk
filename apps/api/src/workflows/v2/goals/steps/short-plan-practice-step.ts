import {
  type ShortPlanPracticeNeed,
  getShortPlanPracticeNeed,
} from "@zoonk/core/lookahead/short-plan-practice";

/** The practice questions a test days away still needs written; null for any longer plan. */
export async function readShortPlanPracticeStep(
  goalId: string,
): Promise<ShortPlanPracticeNeed | null> {
  "use step";

  return getShortPlanPracticeNeed(goalId);
}
