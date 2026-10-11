import { type PlanGraph, type PlanGraphSkill, type PlanSettings } from "./plan-state";
import { type QueueUnit } from "./plan-units";

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
 * An exam's written tests (ENEM's essay, a discursive test, the OAB's legal brief): the areas whose skills
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
 * An exam's units with each written test's first lesson kept like a goal's outcome work (see
 * `makeRoomForOutcomes`): the test's other lessons are cut like any subject's when time is short,
 * but the plan always practices it. Days away, at a few minutes a day, a plan's one or two lessons
 * went to other subjects and left ENEM's essay out.
 */
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
 * Each area's foundations: the skills of the first phase it appears in that another of its skills
 * builds on, when the area goes on in later phases. The skill graph puts there what the area's
 * later skills build on, such as reading before rewriting in an exam's Portuguese, so a learner
 * who knows the area, or shows it on its later skills, starts past them. A first-phase skill
 * nothing builds on is part of what the goal asks, not a basic: the OAB's administrative law
 * had five of its six topics in the first phase, and a learner who knows it well skipped all five
 * as its basics. An area that sits in one phase has none: all of it is what the goal asks.
 */
export function getFoundationSkillIds({
  graph,
  prerequisites,
}: {
  graph: PlanGraph;
  /** Each skill's prerequisites (the Library's edges between the graph's skills). */
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

/** The foundations (see `getFoundationSkillIds`) of these areas. */
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

/** A skill the learner passed over by choice, and the choice: a base skipped, or a basic past. */
export type PassedOver = { area: string; choice: "pastBasics" | "skip"; skillId: string };

/**
 * The skills the learner chose to pass over without answering for them: the bases they skip
 * ("Pular") and the foundations of the areas whose lessons they said are too basic. Their lessons
 * leave the plan, but they stay to confirm: practice asks them, and a miss brings them back.
 */
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
