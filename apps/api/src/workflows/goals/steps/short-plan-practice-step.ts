import {
  type ShortPlanPracticeNeed,
  getShortPlanPracticeNeed,
} from "@zoonk/core/lookahead/short-plan-practice";

export async function readShortPlanPracticeStep(
  goalId: string,
): Promise<ShortPlanPracticeNeed | null> {
  "use step";

  return getShortPlanPracticeNeed(goalId);
}
