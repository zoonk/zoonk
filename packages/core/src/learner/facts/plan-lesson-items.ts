import "server-only";
import { cacheTag } from "next/cache";
import { getGoalsCacheTag, getLearnerModelCacheTag } from "../../cache/tags";
import { LEARN_KINDS } from "../../plans/planner/plan-item-rules";
import { parsePlanGraph } from "../../plans/planner/plan-state";
import { withSkills } from "../../view-models/syllabus/_utils/syllabus-content";
import { toSyllabusItem } from "../../view-models/syllabus/_utils/syllabus-input";
import { withTestedOutSkills } from "../../view-models/syllabus/_utils/syllabus-known-skills";
import { readSavedPlan } from "./saved-plan";

/** Shared by the syllabus and phase progress after ownership authorization. */
export async function readPlanLessonItems(userId: string, goalId: string) {
  "use cache: private";
  cacheTag(getGoalsCacheTag(userId), getLearnerModelCacheTag(userId));
  const plan = await readSavedPlan(userId, goalId);

  if (!plan) {
    return [];
  }

  const graph = parsePlanGraph(plan.graph);
  const graphSkillIds = new Set(graph.skills.map((skill) => skill.skillId));

  const items = await withSkills({
    from: "shared",
    graphSkillIds,
    items: plan.items
      .filter((item) => LEARN_KINDS.has(item.kind))
      .map((item) => toSyllabusItem(item)),
  });

  return withTestedOutSkills({ graphSkillIds, items });
}
