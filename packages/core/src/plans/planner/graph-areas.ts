import { type PlanGraph, type PlanGraphSkill, type PlanSettings } from "./plan-state";
import { type QueueUnit } from "./plan-units";

export function getSkillArea({ graph, skill }: { graph: PlanGraph; skill: PlanGraphSkill }) {
  return skill.area ?? graph.phases[skill.phase]?.name ?? "";
}

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

function getAreaPhases(graph: PlanGraph): Map<string, number> {
  return graph.skills.reduce((phases, skill) => {
    const area = getSkillArea({ graph, skill });
    return phases.set(area, Math.min(phases.get(area) ?? skill.phase, skill.phase));
  }, new Map<string, number>());
}

export function getWrittenTestAreas(graph: PlanGraph): Set<string> {
  const byArea = Map.groupBy(graph.skills, (skill) => getSkillArea({ graph, skill }));

  return new Set(
    [...byArea]
      .filter(([, skills]) => skills.every((skill) => skill.outcome === true))
      .map(([area]) => area),
  );
}

export function keepWrittenTestsIn({
  graph,
  units,
}: {
  graph: PlanGraph;
  units: readonly QueueUnit[];
}): QueueUnit[] {
  const firsts = new Set(
    [...getWrittenTestAreas(graph)].flatMap((area) => {
      const first = units.find((unit) => unit.kind === "lesson" && unit.area === area);
      return first ? [first] : [];
    }),
  );

  return units.map((unit) => (firsts.has(unit) ? { ...unit, outcome: true } : unit));
}

export function getCyclePhases({
  focusAreas,
  gapAreas = new Set(),
  graph,
}: {
  focusAreas: readonly string[];
  gapAreas?: ReadonlySet<string>;
  graph: PlanGraph;
}): Map<string, number> {
  const phases = getAreaPhases(graph);
  const first = Math.min(...phases.values());
  const starting = new Set([...focusAreas, ...gapAreas, ...getWrittenTestAreas(graph)]);

  return new Map([...phases].map(([area, phase]) => [area, starting.has(area) ? first : phase]));
}

export function getFoundationSkillIds({
  graph,
  prerequisites,
}: {
  graph: PlanGraph;
  prerequisites: ReadonlyMap<string, readonly string[]>;
}): Set<string> {
  const byArea = Map.groupBy(graph.skills, (skill) => getSkillArea({ graph, skill }));

  return new Set(
    [...byArea.values()].flatMap((skills) => {
      const phases = skills.map((skill) => skill.phase);
      const first = Math.min(...phases);
      const builtOn = new Set(skills.flatMap((skill) => prerequisites.get(skill.skillId) ?? []));

      return phases.some((phase) => phase > first)
        ? skills
            .filter((skill) => skill.phase === first && builtOn.has(skill.skillId))
            .map((skill) => skill.skillId)
        : [];
    }),
  );
}

export function getAreaFoundationIds({
  areas,
  graph,
  prerequisites,
}: {
  areas: ReadonlySet<string>;
  graph: PlanGraph;
  prerequisites: ReadonlyMap<string, readonly string[]>;
}): Set<string> {
  if (areas.size === 0) {
    return new Set();
  }

  const foundations = getFoundationSkillIds({ graph, prerequisites });

  return new Set(
    graph.skills
      .filter(
        (skill) => foundations.has(skill.skillId) && areas.has(getSkillArea({ graph, skill })),
      )
      .map((skill) => skill.skillId),
  );
}

export type PassedOver = { area: string; choice: "pastBasics" | "skip"; skillId: string };

export function listPassedOver({
  graph,
  prerequisites,
  settings,
}: {
  graph: PlanGraph;
  prerequisites: ReadonlyMap<string, readonly string[]>;
  settings: Pick<PlanSettings, "baseChoices" | "pastBasicsAreas">;
}): PassedOver[] {
  const skipped = new Set(
    settings.baseChoices.flatMap((entry) => (entry.choice === "skip" ? [entry.skillId] : [])),
  );

  const past = getAreaFoundationIds({
    areas: new Set(settings.pastBasicsAreas),
    graph,
    prerequisites,
  });

  return graph.skills.flatMap((skill): PassedOver[] => {
    const area = getSkillArea({ graph, skill });

    if (skipped.has(skill.skillId)) {
      return [{ area, choice: "skip", skillId: skill.skillId }];
    }

    return past.has(skill.skillId) ? [{ area, choice: "pastBasics", skillId: skill.skillId }] : [];
  });
}
