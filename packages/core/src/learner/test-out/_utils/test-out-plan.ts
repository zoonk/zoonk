import "server-only";
import { type ExamBlueprint, type Goal } from "@zoonk/db";
import {
  loadGoalListeningSkillIds,
  loadListeningSkillIds,
} from "../../../exams/listening/listening-skills";
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

type KnownFacts = {
  /** The goal's exam blueprint when the request already read it; without it, it's read fresh. */
  blueprint?: ExamBlueprint | null;
  goal?: Pick<Goal, "examBlueprintId" | "kind" | "targetLanguage"> | null;
  plan?: TestOutPlan;
  source?: SavedSource;
};

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

/** With the goal and its saved plan known, the plan's graph says which skills are listening-only. */
async function loadTestOutListening(
  goalId: string,
  { blueprint, goal, source }: KnownFacts,
): Promise<Set<string>> {
  if (!goal || source === undefined) {
    return goal && goal.kind !== "exam" ? new Set() : loadListeningSkillIds(goalId);
  }

  const saved = await source;
  return loadGoalListeningSkillIds({ blueprint, goal, graph: saved?.graph });
}

/** GETs pass the request's goal and saved source; writes omit them to read after their own changes. */
export async function loadTestOutPlan(
  goalId: string,
  known: KnownFacts = {},
): Promise<TestOutPlan> {
  const [plan, listening] = await Promise.all([
    known.plan ?? loadTestOutItems(goalId, known.source),
    loadTestOutListening(goalId, known),
  ]);

  return { items: plan.items, skills: plan.skills.filter((skill) => !listening.has(skill.id)) };
}
