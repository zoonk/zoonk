import { type BuiltPlan, type PlanningMode } from "./build-plan";
import { type StrainedEnd } from "./kept-phase-ends";
import { getEndOfWeek } from "./plan-calendar";
import { type PhaseEndMove, type PlanEffect } from "./plan-effect";
import { type PlanGraph, type PlanPhase } from "./plan-state";

const MIN_GAINED_MINUTES = 1;

function countCoveredMinutes(built: Pick<BuiltPlan, "skillMinutes">): number {
  return built.skillMinutes.reduce((total, skill) => total + skill.covered, 0);
}

function movesPhaseEnds({
  kept,
  moved,
}: {
  kept: Pick<BuiltPlan, "phases">;
  moved: Pick<BuiltPlan, "phases">;
}): boolean {
  return kept.phases.some((phase, index) => phase.endDate !== moved.phases[index]?.endDate);
}

export function mayCostToKeepPhaseDates(
  kept: Pick<BuiltPlan, "droppedSkillIds" | "endsBeforeLessons" | "strainedEnds">,
): boolean {
  return (
    kept.droppedSkillIds.length > 0 ||
    kept.strainedEnds.length > 0 ||
    kept.endsBeforeLessons.length > 0
  );
}

function listFittedOutcomes({
  graph,
  kept,
  moved,
}: {
  graph: Pick<PlanGraph, "skills">;
  kept: Pick<BuiltPlan, "droppedSkillIds">;
  moved: Pick<BuiltPlan, "droppedSkillIds">;
}): string[] {
  const left = new Set(kept.droppedSkillIds);
  const fitted = new Set(moved.droppedSkillIds);

  return graph.skills.flatMap((skill) =>
    skill.outcome && left.has(skill.skillId) && !fitted.has(skill.skillId) ? [skill.name] : [],
  );
}

type MovePlan = Pick<
  BuiltPlan,
  "droppedSkillIds" | "endsBeforeLessons" | "phases" | "skillMinutes" | "strainedEnds"
>;

export function isPhaseDatesMoveWorth({
  graph,
  kept,
  moved,
}: {
  graph: Pick<PlanGraph, "skills">;
  kept: MovePlan;
  moved: MovePlan;
}): boolean {
  const gained = countCoveredMinutes(moved) - countCoveredMinutes(kept);
  const held = kept.strainedEnds.length > 0 || kept.endsBeforeLessons.length > 0;
  const freed = held && movesPhaseEnds({ kept, moved });

  return (
    gained >= MIN_GAINED_MINUTES || freed || listFittedOutcomes({ graph, kept, moved }).length > 0
  );
}

export function showsPhaseDatesMove(
  effect: Pick<PlanEffect, "lessonsAdded" | "outcomesAdded" | "phaseEnds">,
): boolean {
  return (
    effect.lessonsAdded > 0 ||
    (effect.phaseEnds ?? []).length > 0 ||
    (effect.outcomesAdded ?? []).length > 0
  );
}

export function listPhaseEndMoves({
  after,
  lessonsFirst = new Set(),
  resting = new Set(),
  shown,
}: {
  after: readonly Pick<PlanPhase, "endDate">[];
  lessonsFirst?: ReadonlySet<number>;
  resting?: ReadonlySet<number>;
  shown: readonly PlanPhase[];
}): PhaseEndMove[] {
  return shown.slice(0, -1).flatMap((phase, index) => {
    const end = after[index]?.endDate;

    if (!phase.endDate || !end || end === phase.endDate) {
      return [];
    }

    return [
      {
        after: end,
        before: phase.endDate,
        ...(lessonsFirst.has(index) && { lessonsFirst: true as const }),
        name: phase.name,
        ...(resting.has(index) && { restDay: true as const }),
      },
    ];
  });
}

export function getPhaseDatesEffect({
  graph,
  kept,
  moved,
  shown,
}: {
  graph: Pick<PlanGraph, "skills">;
  kept: Pick<BuiltPlan, "droppedSkillIds" | "endsBeforeLessons" | "strainedEnds">;
  moved: Pick<BuiltPlan, "droppedSkillIds" | "phases">;
  shown: readonly PlanPhase[];
}): Pick<PlanEffect, "outcomesAdded" | "phaseEnds"> {
  const outcomes = listFittedOutcomes({ graph, kept, moved });

  return {
    ...(outcomes.length > 0 ? { outcomesAdded: outcomes } : {}),
    phaseEnds: listPhaseEndMoves({
      after: moved.phases,
      lessonsFirst: new Set(kept.endsBeforeLessons),
      resting: new Set(kept.strainedEnds.flatMap((end) => (end.resting ? [end.phase] : []))),
      shown,
    }),
  };
}

export function isKeptOver({
  declined,
  effect,
}: {
  declined: Pick<PlanEffect, "outcomesAdded" | "phaseEnds"> | null;
  effect: Pick<PlanEffect, "outcomesAdded" | "phaseEnds">;
}): boolean {
  const outcomes = new Set(declined?.outcomesAdded);

  const moves = new Map((declined?.phaseEnds ?? []).map((move) => [move.name, move]));

  return (
    (effect.outcomesAdded ?? []).every((name) => outcomes.has(name)) &&
    (effect.phaseEnds ?? []).every(
      (move) =>
        (!move.restDay || moves.get(move.name)?.restDay) &&
        (!move.lessonsFirst || moves.get(move.name)?.lessonsFirst),
    )
  );
}

export function moveStrainedEnds({
  ends,
  strained,
}: {
  ends: ReadonlyMap<number, string>;
  strained: readonly StrainedEnd[];
}): Map<number, string> {
  const rooms = new Map(
    strained.flatMap((end) => {
      const overloadedWithLater = strained.some(
        (other) => other.phase > end.phase && ends.get(other.phase) === ends.get(end.phase),
      );

      return end.room && (end.resting || !overloadedWithLater) ? [[end.phase, end.room]] : [];
    }),
  );

  return [...ends.keys()]
    .toSorted((first, second) => first - second)
    .reduce((moved, phase) => {
      const date = rooms.get(phase) ?? ends.get(phase) ?? "";
      const previous = [...moved.values()].at(-1) ?? "";

      return moved.set(phase, date < previous ? previous : date);
    }, new Map<number, string>());
}

export function getPhaseDatesMoveMode({
  kept,
  mode,
  shown,
  today,
}: {
  kept: Pick<BuiltPlan, "endsBeforeLessons" | "strainedEnds">;
  mode: PlanningMode;
  shown: ReadonlyMap<number, Date>;
  today: Date;
}): PlanningMode {
  const weekEnd = getEndOfWeek(today);
  const moving = [...kept.endsBeforeLessons, ...kept.strainedEnds.map((end) => end.phase)];
  const date = (phase: number) => shown.get(phase);

  return moving.some((phase) => (date(phase) ?? weekEnd) <= weekEnd) ? "forced" : mode;
}

export function listReleasedEnds({
  after,
  kept,
  shown,
}: {
  after: readonly Pick<PlanPhase, "endDate">[];
  kept: ReadonlyMap<number, Date> | undefined;
  shown: readonly PlanPhase[];
}): PhaseEndMove[] {
  const ends = kept ?? new Map<number, Date>();

  return listPhaseEndMoves({
    after,
    lessonsFirst: new Set(ends.keys()),
    shown: shown.map((phase, index) => (ends.has(index) ? phase : { ...phase, endDate: null })),
  });
}
