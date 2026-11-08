import "server-only";
import { type Goal, type Plan } from "@zoonk/db";
import { type SizedSkill } from "../../plans/_utils/half-studied";
import { resolveMergedSkills } from "../../plans/_utils/planner-inputs";
import { loadGoalPlannerLessons } from "../../plans/_utils/planner-lessons";
import { type PlanGraphSkill, parsePlanGraph } from "../../plans/planner/plan-state";
import { countTaughtLessons } from "../../plans/planner/plan-units";
import { getSkippedSkillIds } from "../../sessions/_utils/review-skills";

type SizedGoal = Pick<Goal, "details" | "examBlueprintId" | "kind" | "primaryCourseId" | "userId">;

function getSize({
  removed,
  skill,
  taught,
}: {
  removed: ReadonlySet<string>;
  skill: PlanGraphSkill;
  taught: ReadonlyMap<string, number>;
}): number {
  if (removed.has(skill.skillId)) {
    return 0;
  }

  return skill.outlined ? (taught.get(skill.skillId) ?? 0) : skill.lessons;
}

/**
 * The plan's graph skills, merged ones under their survivor as a re-plan merges them, each at its
 * full size: the written lessons the planner gives it once it's outlined, its estimate until then,
 * and nothing in an area the learner removed. A dated plan's cuts, a test-out and a re-plan leave
 * it as it is.
 */
export async function loadSkillSizes({
  goal,
  plan,
}: {
  goal: SizedGoal;
  plan: Pick<Plan, "graph" | "settings">;
}): Promise<(PlanGraphSkill & SizedSkill)[]> {
  const graph = await resolveMergedSkills(parsePlanGraph(plan.graph));
  const removed = getSkippedSkillIds({ graph, settings: plan.settings });
  const kept = graph.skills.filter((skill) => !removed.has(skill.skillId));

  const lessons = kept.some((skill) => skill.outlined)
    ? await loadGoalPlannerLessons({ goal, graph: { ...graph, skills: kept }, userId: goal.userId })
    : [];

  const taught = countTaughtLessons({ lessons, skills: kept });

  return graph.skills.map((skill) => ({ ...skill, size: getSize({ removed, skill, taught }) }));
}
