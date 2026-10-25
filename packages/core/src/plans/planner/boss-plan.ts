import { type ItemSkillRows, projectPlanSkills } from "../../learner/_utils/goal-plan-projection";
import { getSkippedSkillIds } from "../../sessions/_utils/review-skills";
import { type BuildPlanInput } from "./build-plan";
import { type PlannedItem } from "./plan-items";

/**
 * A built plan as its bosses read it once saved (see `getBossSkillIds`): its items in plan order
 * (their key for an id), each item's skills as `loadGoalPlan` reads them (`rows`, `survivors`; the
 * items' own skills without them), the graph's skills with the lessons this build counted, and the
 * plan's skills without the areas the learner took out.
 */
export function toBossPlan({
  input,
  items,
  rows = { chapterLessons: [], lessonSkills: [] },
  skillLessons,
  survivors = new Map(),
}: {
  input: Pick<BuildPlanInput, "goal" | "graph" | "settings">;
  items: readonly PlannedItem[];
  rows?: ItemSkillRows;
  skillLessons: ReadonlyMap<string, number>;
  survivors?: ReadonlyMap<string, string>;
}) {
  const saved = items.map((item, position) => ({ ...item, id: item.key, position }));

  const projected = projectPlanSkills({
    graph: input.graph,
    items: saved,
    rows,
    survivorOf: (skillId) => survivors.get(skillId) ?? skillId,
  });

  const skipped = getSkippedSkillIds({ graph: input.graph, settings: input.settings });

  return {
    graphSkills: input.graph.skills.map((skill) => ({
      ...skill,
      plannedLessons: skillLessons.get(skill.skillId) ?? 0,
    })),
    itemSkillIds: projected.itemSkillIds,
    items: saved,
    skills: projected.skillIds.filter((id) => !skipped.has(id)).map((id) => ({ id })),
    targetDate: input.goal.targetDate,
  };
}
