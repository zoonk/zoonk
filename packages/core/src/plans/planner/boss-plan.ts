import { type ItemSkillRows, projectPlanSkills } from "../../learner/_utils/goal-plan-projection";
import { getSkippedSkillIds } from "../../sessions/_utils/review-skills";
import { type BuildPlanInput } from "./build-plan";
import { type PlannedItem } from "./plan-items";

export function toBossPlan({
  input,
  items,
  phases,
  rows = { chapterLessons: [], lessonSkills: [] },
  skillLessons,
  survivors = new Map(),
}: {
  input: Pick<BuildPlanInput, "goal" | "graph" | "settings">;
  items: readonly PlannedItem[];
  phases?: readonly { kind?: string; endDate?: string | null }[];
  rows?: ItemSkillRows;
  skillLessons: ReadonlyMap<string, number>;
  survivors?: ReadonlyMap<string, string>;
}) {
  const extras = new Set(
    [...input.graph.skills.filter((skill) => skill.extra), ...(input.graph.extraSkills ?? [])].map(
      (skill) => skill.skillId,
    ),
  );

  const graph = { ...input.graph, skills: input.graph.skills.filter((skill) => !skill.extra) };
  const ordinary = new Set(graph.skills.map((skill) => skill.skillId));

  const saved = items
    .map((item, position) => ({ ...item, id: item.key, position }))
    .filter((item) => !item.skillId || !extras.has(item.skillId) || ordinary.has(item.skillId));

  const projected = projectPlanSkills({
    graph,
    items: saved,
    rows,
    survivorOf: (skillId) => survivors.get(skillId) ?? skillId,
  });

  const skipped = getSkippedSkillIds({ graph, settings: input.settings });

  return {
    graphSkills: graph.skills.map((skill) => ({
      ...skill,
      plannedLessons: skillLessons.get(skill.skillId) ?? 0,
    })),
    itemSkillIds: projected.itemSkillIds,
    items: saved,
    phases,
    skills: projected.skillIds.filter((id) => !skipped.has(id)).map((id) => ({ id })),
    targetDate: input.goal.targetDate,
  };
}
