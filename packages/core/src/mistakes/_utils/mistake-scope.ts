import "server-only";
import { getMemberSkillIds } from "../../learner/_utils/goal-skill-graph";
import { readGoalPlan } from "../../learner/_utils/read-goal-plan";
import { type MistakeListInput } from "../contract";

/** Null means no skill filter. */
export async function getScopeSkillIds(
  input: Pick<MistakeListInput, "goalId" | "skillId">,
): Promise<string[] | null> {
  if (input.skillId) {
    return [input.skillId];
  }

  if (!input.goalId) {
    return null;
  }

  const plan = await readGoalPlan(input.goalId);
  return getMemberSkillIds(plan.skills);
}
