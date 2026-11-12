import { getSkillArea } from "../planner/graph-areas";
import { type PlanGraph } from "../planner/plan-state";

export function listPlanAreaNames({
  focusAreas,
  graph,
}: {
  focusAreas: readonly string[];
  graph: PlanGraph;
}): string[] {
  const names = graph.skills.map((skill) => getSkillArea({ graph, skill }));

  return [...new Set([...focusAreas.filter((name) => names.includes(name)), ...names])];
}
