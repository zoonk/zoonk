import { normalizeString } from "@zoonk/utils/string";
import { getWritingSkillIds } from "../../learner/writing-skills";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { type listWrittenTasks } from "../../library/exams/written-tasks";
import { getAreasOf, getSkillArea } from "./graph-areas";
import { type PlanGraph } from "./plan-state";

type Task = Pick<ReturnType<typeof listWrittenTasks>[number], "section" | "subjects">;

export function keptWritingArea(skippedAreas: readonly string[]) {
  const skipped = new Set(skippedAreas.map((area) => normalizeString(area)));
  return (area: string) => !skipped.has(normalizeString(area));
}

export function planWritingScope({
  graph,
  skippedAreas,
  structure,
}: {
  graph: PlanGraph;
  skippedAreas: readonly string[];
  structure: ExamStructure | null;
}) {
  const keepsArea = keptWritingArea(skippedAreas);

  const keptSkills = new Set(
    graph.skills
      .filter((skill) => keepsArea(getSkillArea({ graph, skill })))
      .map(({ skillId }) => skillId),
  );

  function keepsTask(task: Task) {
    if (skippedAreas.length === 0) {
      return true;
    }

    if (!keepsArea(task.section)) {
      return false;
    }

    const subjects =
      task.subjects ??
      (structure?.subjects ?? []).flatMap(({ group, name, partOf }) =>
        [group, partOf].some(
          (label) => label && normalizeString(label) === normalizeString(task.section),
        )
          ? [name]
          : [],
      );

    if (subjects.length > 0) {
      return subjects.some((area) => keepsArea(area));
    }

    const skillIds = getWritingSkillIds({ graph, section: task.section, structure });
    const areas = getAreasOf({ graph, skillIds });
    return areas.size === 0 || [...areas].some((area) => keepsArea(area));
  }

  return { keepsTask, keptSkills };
}
