import "server-only";
import { type Goal } from "@zoonk/db";
import { loadListeningSkillIds } from "../../../exams/listening/listening-skills";
import { unique } from "../../_utils/goal-plan-projection";
import {
  type GoalPlanItem,
  type GoalPlanSource,
  type GoalSkillNode,
  loadPlanEntries,
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

/** The saved plan a GET reads once per request (`readSavedPlan`), or its pending read. */
type SavedSource = GoalPlanSource | null | Promise<GoalPlanSource | null>;

/** Test-outs need item membership, not the titles, prerequisites and bands placement reads. */
async function loadTestOutItems(goalId: string, known?: SavedSource): Promise<TestOutPlan> {
  const source = await known;

  const loaded =
    source === null ? null : await loadPlanEntries({ goalId, source, withLeftOut: false });

  if (!loaded) {
    return { items: [], skills: [] };
  }

  return {
    items: loaded.plan.items.map((item) => ({
      chapterId: item.chapterId,
      id: item.id,
      lessonId: item.lessonId,
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

/**
 * The goal's plan for a test-out. A GET passes the request's saved plan (`readSavedPlan`) as
 * `source`; a write leaves it out and reads the plan after its own writes.
 */
export async function loadTestOutPlan(
  goalId: string,
  known: { goal?: Pick<Goal, "kind">; plan?: TestOutPlan; source?: SavedSource } = {},
): Promise<TestOutPlan> {
  const [plan, listening] = await Promise.all([
    known.plan ?? loadTestOutItems(goalId, known.source),
    known.goal && known.goal.kind !== "exam" ? new Set<string>() : loadListeningSkillIds(goalId),
  ]);

  return { items: plan.items, skills: plan.skills.filter((skill) => !listening.has(skill.id)) };
}
