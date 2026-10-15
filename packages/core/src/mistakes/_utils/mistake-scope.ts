import "server-only";
import { readGoalPlan } from "../../learner/_utils/read-goal-plan";
import { type MistakeListInput } from "../contract";

/** The notebook's exact skill scope, including finer skills taught by its goal's lessons. */
export async function getScopeSkillIds(
  input: Pick<MistakeListInput, "goalId" | "skillId">,
): Promise<string[] | null> {
  if (input.skillId) {
    return [input.skillId];
  }

  if (!input.goalId) {
    return null;
  }

  // A goal skill's lessons usually teach finer skills, where their screens' misses land
  // (`memberSkillIds`): the notebook lists those with the goal's own, as Today's practice drills them.
  const plan = await readGoalPlan(input.goalId);
  return [...new Set(plan.skills.flatMap((skill) => skill.memberSkillIds))];
}
