import "server-only";
import { type Goal } from "@zoonk/db";
import { loadListeningSkillIds } from "../../../exams/listening/listening-skills";
import { unique } from "../../_utils/goal-plan-projection";
import {
  type GoalPlanItem,
  type GoalSkillNode,
  loadPlanEntries,
} from "../../_utils/goal-skill-graph";

/** Excludes listening-only skills because a text test cannot justify skipping their lessons. */
export type TestOutPlan = { items: GoalPlanItem[]; skills: Pick<GoalSkillNode, "areaId" | "id">[] };

async function loadTestOutItems(goalId: string): Promise<TestOutPlan> {
  const loaded = await loadPlanEntries({ goalId, withLeftOut: false });

  if (!loaded) {
    return { items: [], skills: [] };
  }

  return {
    items: loaded.plan.items.map((item) => ({
      chapterId: item.chapterId,
      id: item.id,
      skillIds: unique(
        loaded.allEntries
          .filter((entry) => entry.planItemId === item.id)
          .map((entry) => entry.skillId),
      ),
      status: item.status,
    })),
    skills: loaded.entries.map((entry) => ({ areaId: entry.areaId, id: entry.skillId })),
  };
}

export type TestOutPlanReader = (goalId: string) => Promise<TestOutPlan>;

/** GETs pass a plan they loaded or the request's reader (`readGoalPlan`); writes omit both to read after their own changes. */
export async function loadTestOutPlan(
  goalId: string,
  known: { goal?: Pick<Goal, "kind">; plan?: TestOutPlan; readPlan?: TestOutPlanReader } = {},
): Promise<TestOutPlan> {
  const { readPlan = loadTestOutItems } = known;

  const [plan, listening] = await Promise.all([
    known.plan ?? readPlan(goalId),
    known.goal && known.goal.kind !== "exam" ? new Set<string>() : loadListeningSkillIds(goalId),
  ]);

  return { items: plan.items, skills: plan.skills.filter((skill) => !listening.has(skill.id)) };
}
