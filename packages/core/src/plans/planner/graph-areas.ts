import { type PlanGraph, type PlanGraphSkill } from "./plan-state";

/** A skill's area: the course the graph put it in, or its phase when the graph named none. */
export function getSkillArea({ graph, skill }: { graph: PlanGraph; skill: PlanGraphSkill }) {
  return skill.area ?? graph.phases[skill.phase]?.name ?? "";
}

/** The areas these skills belong to. */
export function getAreasOf({
  graph,
  skillIds,
}: {
  graph: PlanGraph;
  skillIds: ReadonlySet<string>;
}): Set<string> {
  return new Set(
    graph.skills
      .filter((skill) => skillIds.has(skill.skillId))
      .map((skill) => getSkillArea({ graph, skill })),
  );
}

/** The phase each area starts in: its earliest skill's. */
function getAreaPhases(graph: PlanGraph): Map<string, number> {
  return graph.skills.reduce((phases, skill) => {
    const area = getSkillArea({ graph, skill });
    return phases.set(area, Math.min(phases.get(area) ?? skill.phase, skill.phase));
  }, new Map<string, number>());
}

/**
 * An exam's written tests (a redação, a discursive test, a peça técnica): the areas whose skills
 * are all outcome skills, which the skill graph gives an exam only for the parts answered in
 * writing (see `PlanGraphSkill.outcome`). Writing is a skill that improves with graded practice
 * spread over weeks, not a body of topics to get through once, so the study cycle starts them in
 * the first week and never lets them fall below a protected share (see `buildPlanQueue`).
 */
export function getWrittenTestAreas(graph: PlanGraph): Set<string> {
  const byArea = Map.groupBy(graph.skills, (skill) => getSkillArea({ graph, skill }));

  return new Set(
    [...byArea]
      .filter(([, skills]) => skills.every((skill) => skill.outcome === true))
      .map(([area]) => area),
  );
}

/**
 * The phase each area joins an exam's study cycle at: where it starts in the graph, or the first
 * phase for an area the learner focused on, one placement found a gap in and a written test, so
 * it starts right away (with what it builds on in other subjects brought forward) instead of
 * joining over the first two weeks: a discursive test that builds on the notice's later topics was
 * otherwise first practiced weeks in, and Rafaela's English, a gap in a later phase, days in.
 */
export function getCyclePhases({
  focusAreas,
  gapAreas = new Set(),
  graph,
}: {
  focusAreas: readonly string[];
  /** The areas the learner's last test found gaps in. */
  gapAreas?: ReadonlySet<string>;
  graph: PlanGraph;
}): Map<string, number> {
  const phases = getAreaPhases(graph);
  const first = Math.min(...phases.values());
  const starting = new Set([...focusAreas, ...gapAreas, ...getWrittenTestAreas(graph)]);

  return new Map([...phases].map(([area, phase]) => [area, starting.has(area) ? first : phase]));
}

/**
 * Each area's foundations: its skills in the first phase it appears in, when the area goes on in
 * later phases. The skill graph puts there what the area's other skills build on, such as reading
 * before rewriting in an exam's Portuguese, so a learner who knows the area, or shows it on its
 * later skills, starts past them. An area that sits in one phase has none: all of it is what the
 * goal asks.
 */
export function getFoundationSkillIds(graph: PlanGraph): Set<string> {
  const byArea = Map.groupBy(graph.skills, (skill) => getSkillArea({ graph, skill }));

  return new Set(
    [...byArea.values()].flatMap((skills) => {
      const phases = skills.map((skill) => skill.phase);
      const first = Math.min(...phases);

      return phases.some((phase) => phase > first)
        ? skills.filter((skill) => skill.phase === first).map((skill) => skill.skillId)
        : [];
    }),
  );
}
