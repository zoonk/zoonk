import "server-only";
import { readGoalPlan } from "../../learner/_utils/read-goal-plan";
import { type MistakeListInput } from "../contract";

/** Includes finer member skills taught by a goal's lessons; null means no skill filter. */
export async function getScopeSkillIds(
  input: Pick<MistakeListInput, "goalId" | "skillId">,
): Promise<string[] | null> {
  if (input.skillId) {
    return [input.skillId];
  }

  if (!input.goalId) {
    return null;
  }

  // Screen misses land on finer skills, so include them alongside the plan's goal skills.
  const plan = await readGoalPlan(input.goalId);
  return [...new Set(plan.skills.flatMap((skill) => skill.memberSkillIds))];
}
