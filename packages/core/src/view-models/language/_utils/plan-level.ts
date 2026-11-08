import "server-only";
import { type Goal } from "@zoonk/db";
import { parseCefrScore } from "@zoonk/utils/cefr";
import { getPlanLevelLabel, groupLevelItems } from "../../../language/levels/plan-levels";
import { readSavedPlan } from "../../../learner/facts/saved-plan";
import { getSkillLevelRows, toIdKey } from "../../../library/_utils/shared-rows";
import { loadPlanScope } from "../../../plans/_utils/plan-scope";
import { type LanguageProgressView } from "../language-view-contract";

type PlanLevel = LanguageProgressView["level"];
type LevelTarget = LanguageProgressView["target"];

/** "B2 → B1+" reads just "B2": the goal shows beside the level only while the plan is below it. */
function toPlanLevel({
  label,
  target,
}: {
  label: string;
  target: LevelTarget;
}): NonNullable<PlanLevel> {
  const score = parseCefrScore(label);
  const below = target !== null && score !== null && score < target.score;

  return { label, target: below ? target.label : null };
}

/** GET-only, after ownership authorization. Null while the plan has no lessons. */
export async function readPlanLevel({
  goal,
  target,
}: {
  goal: Goal;
  target: LevelTarget;
}): Promise<PlanLevel> {
  const plan = await readSavedPlan(goal.userId, goal.id);

  if (!plan) {
    return null;
  }

  const scope = await loadPlanScope({ goal, plan });

  const skills = await getSkillLevelRows(
    toIdKey([
      ...scope.graphSkillIds,
      ...plan.items.map((item) => (item.kind === "lesson" ? item.skillId : null)),
    ]),
  );

  const label = getPlanLevelLabel(
    groupLevelItems({
      items: plan.items,
      scope,
      skills: new Map(skills.map((skill) => [skill.id, skill])),
    }),
  );

  return label ? toPlanLevel({ label, target }) : null;
}
