import "server-only";
import { type GoalCreateResult, createGoals } from "../../goals/create-goals";
import { type GoalCreateInput } from "../../goals/goal-contract";

/** Requires sign-in; links the main goal to the learner's own uploads and defers memory until age and onboarding answers are known. */
export async function createOnboardingGoals(input: GoalCreateInput): Promise<GoalCreateResult> {
  return createGoals(input);
}
