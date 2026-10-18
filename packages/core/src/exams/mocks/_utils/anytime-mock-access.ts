import "server-only";
import { type Goal } from "@zoonk/db";
import { getAllowance } from "../../../entitlements/get-allowance";

export type AnytimeMockAccess = "open" | "plusRequired";

/**
 * Whether the learner's plan lets them take a mock now. Every mock exam comes with Plus: the ones
 * taken any time, the plan's weekly ones and a diagnostic one in onboarding instead of the quick
 * placement. Free learners and guests see them with what it takes, and place with the quick
 * questions.
 */
export async function getAnytimeMockAccess({
  goal,
}: {
  goal: Goal;
  timeZone: string;
}): Promise<AnytimeMockAccess> {
  const allowance = await getAllowance();

  return goal.kind === "exam" && allowance?.examPrep.includesMockExams === false
    ? "plusRequired"
    : "open";
}
