import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { getSkillAreaShares } from "../../plans/_utils/exam-subject-shares";
import { getFocusTargets } from "../../plans/planner/focus-targets";
import { getSkillArea } from "../../plans/planner/graph-areas";
import { type PlanGraph, parsePlanSettings } from "../../plans/planner/plan-state";

function getFocusedSkillIds({
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

export function getSkippedSkillIds({
  graph,
  settings,
}: {
  graph: PlanGraph;
  settings: unknown;
}): Set<string> {
  const skipped = new Set(parsePlanSettings(settings).skippedAreas);

  return new Set(
    graph.skills
      .filter((skill) => skipped.has(getSkillArea({ graph, skill })))
      .map((skill) => skill.skillId),
  );
}

/** Includes plan skills even when the day's time cannot fit them; excludes learner-removed areas. */
export function getTestSkillIds({
  graph,
  planSkillIds,
  settings,
}: {
  graph: PlanGraph;
  planSkillIds: readonly string[];
  settings: unknown;
}): string[] {
  const skipped = getSkippedSkillIds({ graph, settings });
  const graphSkillIds = graph.skills.map((skill) => skill.skillId);

  return [...new Set([...planSkillIds, ...graphSkillIds])].filter(
    (skillId) => !skipped.has(skillId),
  );
}

export function getPracticeWeights({
  graph,
  isReviewDay,
  settings,
  structure,
}: {
  graph: PlanGraph;
  isReviewDay: boolean;
  settings: unknown;
  structure: ExamStructure | null;
}) {
  return {
    focusSkillIds: isReviewDay ? getFocusedSkillIds({ graph, settings }) : undefined,
    skillAreaShares: getSkillAreaShares({ graph, structure }),
  };
}
