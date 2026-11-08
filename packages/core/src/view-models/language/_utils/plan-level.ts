import "server-only";
import { getPlanLevelLabel, listPlanLevels } from "../../../language/levels/plan-levels";
import { readSavedPlan } from "../../../learner/facts/saved-plan";
import { getSkillLevelRows, toIdKey } from "../../../library/_utils/shared-rows";
import { parsePlanGraph } from "../../../plans/planner/plan-state";

/** GET-only, after ownership authorization. Null while the plan has no lessons. */
export async function readPlanLevel({
  goalId,
  userId,
}: {
  goalId: string;
  userId: string;
}): Promise<string | null> {
  const plan = await readSavedPlan(userId, goalId);

  if (!plan) {
    return null;
  }

  const graphSkills = parsePlanGraph(plan.graph).skills;

  const skills = await getSkillLevelRows(
    toIdKey([
      ...graphSkills.map((skill) => skill.skillId),
      ...plan.items.map((item) => (item.kind === "lesson" ? item.skillId : null)),
    ]),
  );

  return getPlanLevelLabel(
    listPlanLevels({
      graphSkills,
      items: plan.items,
      skills: new Map(skills.map((skill) => [skill.id, skill])),
    }),
  );
}
