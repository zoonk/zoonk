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

/** Excludes listening-only skills because a text test cannot justify skipping their lessons. */
export type TestOutPlan = {
  items: (GoalPlanItem & { lessonId?: string | null })[];
  skills: Pick<GoalSkillNode, "areaId" | "id">[];
};

type SavedSource = GoalPlanSource | null | Promise<GoalPlanSource | null>;

async function loadTestOutItems(goalId: string, known?: SavedSource): Promise<TestOutPlan> {
  const source = await known;

  const loaded =
    source === null
      ? null
      : await loadPlanEntries({
          goalId,
          sharedLibrary: source !== undefined,
          source,
          withLeftOut: false,
        });

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

/** GETs pass the request's saved source; writes omit it to read after their own changes. */
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
