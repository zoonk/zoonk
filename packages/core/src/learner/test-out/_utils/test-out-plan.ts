import "server-only";
import { type Goal } from "@zoonk/db";
import { loadListeningSkillIds } from "../../../exams/listening/listening-skills";
import { firstPerSkill, unique } from "../../_utils/goal-plan-projection";
import {
  type GoalPlanItem,
  type GoalSkillNode,
  loadPlanEntryRows,
  toSurvivingSkills,
} from "../../_utils/goal-skill-graph";

/**
 * The goal's plan as a chapter test-out reads it: without the skills its exam practices only with
 * recordings, which a text question can't show known, so a pass never skips their lessons and a
 * chapter that teaches only them offers no test-out.
 */
export type TestOutPlan = {
  items: (GoalPlanItem & { lessonId?: string | null })[];
  skills: Pick<GoalSkillNode, "areaId" | "id">[];
};

/** Test-outs need item membership, not the titles, prerequisites and bands placement reads. */
async function loadTestOutItems(goalId: string): Promise<TestOutPlan> {
  const loaded = await loadPlanEntryRows({ goalId, withLeftOut: false });

  if (!loaded) {
    return { items: [], skills: [] };
  }

  const allEntries = await toSurvivingSkills(loaded.allEntries);

  return {
    items: loaded.plan.items.map((item) => ({
      ...item,
      skillIds: unique(
        allEntries.filter((entry) => entry.planItemId === item.id).map((entry) => entry.skillId),
      ),
    })),
    skills: firstPerSkill(allEntries).map((entry) => ({ areaId: entry.areaId, id: entry.skillId })),
  };
}

export async function loadTestOutPlan(
  goalId: string,
  known: { goal?: Pick<Goal, "kind">; plan?: TestOutPlan } = {},
): Promise<TestOutPlan> {
  const [plan, listening] = await Promise.all([
    known.plan ?? loadTestOutItems(goalId),
    known.goal && known.goal.kind !== "exam" ? new Set<string>() : loadListeningSkillIds(goalId),
  ]);

  return { ...plan, skills: plan.skills.filter((skill) => !listening.has(skill.id)) };
}
