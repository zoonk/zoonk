import { getFocusTargets } from "../../plans/planner/focus-targets";
import { getSkillArea } from "../../plans/planner/graph-areas";
import { type PlanGraph, parsePlanSettings } from "../../plans/planner/plan-state";

/** The skills the learner's focus names: the parts they named, or their areas whole. */
export function getFocusedSkillIds({
  graph,
  settings,
}: {
  graph: PlanGraph;
  settings: unknown;
}): Set<string> {
  const parsed = parsePlanSettings(settings);

  return new Set(
    getFocusTargets({ areas: parsed.focusAreas, graph, settings: parsed }).flatMap((target) => [
      ...target.skillIds,
    ]),
  );
}

/**
 * Every skill the test asks: the skill graph's, but for the areas the learner took out, and the
 * ones the plan's lessons teach, whether or not its days had room for them.
 */
export function getTestSkillIds({
  graph,
  planSkillIds,
  settings,
}: {
  graph: PlanGraph;
  planSkillIds: readonly string[];
  settings: unknown;
}): string[] {
  const skipped = new Set(parsePlanSettings(settings).skippedAreas);

  const graphSkillIds = graph.skills
    .filter((skill) => !skipped.has(getSkillArea({ graph, skill })))
    .map((skill) => skill.skillId);

  return [...new Set([...planSkillIds, ...graphSkillIds])];
}
