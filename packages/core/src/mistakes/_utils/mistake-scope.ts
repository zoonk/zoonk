import "server-only";
import { getMistakeSkillIds } from "../../learner/_utils/goal-skill-graph";
import { readGoalPlan } from "../../learner/_utils/read-goal-plan";
import { type MistakeListInput } from "../contract";

/** A skill outside the goal's scope narrows to nothing. Null means no skill filter. */
export function narrowToSkill({
  scopeSkillIds,
  skillId,
}: {
  scopeSkillIds: string[] | null;
  skillId: string | undefined;
}): string[] | null {
  if (!skillId) {
    return scopeSkillIds;
  }

  return !scopeSkillIds || scopeSkillIds.includes(skillId) ? [skillId] : [];
}

/** Null means no skill filter. */
export async function getScopeSkillIds(
  input: Pick<MistakeListInput, "goalId" | "skillId">,
): Promise<string[] | null> {
  const plan = input.goalId ? await readGoalPlan(input.goalId) : null;

  return narrowToSkill({
    scopeSkillIds: plan && getMistakeSkillIds(plan.skills),
    skillId: input.skillId,
  });
}
