import { type BuiltPlan, type PlanningMode } from "./build-plan";
import { type StrainedEnd } from "./kept-phase-ends";
import { getEndOfWeek } from "./plan-calendar";
import { type PhaseEndMove, type PlanEffect } from "./plan-effect";
import { type PlanGraph, type PlanPhase } from "./plan-state";

/** Less than a minute more isn't a lesson more by the goal's date. */
const MIN_GAINED_MINUTES = 1;

/** The lesson minutes a plan fits before its deadline, done ones included. */
function countCoveredMinutes(built: Pick<BuiltPlan, "skillMinutes">): number {
  return built.skillMinutes.reduce((total, skill) => total + skill.covered, 0);
}

/** Whether two plans end some phase on different days. */
function movesPhaseEnds({
  kept,
  moved,
}: {
  kept: Pick<BuiltPlan, "phases">;
  moved: Pick<BuiltPlan, "phases">;
}): boolean {
  return kept.phases.some((phase, index) => phase.endDate !== moved.phases[index]?.endDate);
}

/**
 * Whether keeping the phase dates the learner saw may cost them something moving the dates gives
 * back: lessons left out by the goal's date, a challenge held on a day without room for it (see
 * `listStrainedEnds`), or one that comes before lessons it tests (see `listEndsBeforeLessons`).
 */
export function mayCostToKeepPhaseDates(
  kept: Pick<BuiltPlan, "droppedSkillIds" | "endsBeforeLessons" | "strainedEnds">,
): boolean {
  return (
    kept.droppedSkillIds.length > 0 ||
    kept.strainedEnds.length > 0 ||
    kept.endsBeforeLessons.length > 0
  );
}

/**
 * The goal's outcome skills (a career's job search) keeping the phase dates (`kept`) leaves out by
 * the goal's date that moving them (`moved`) fits in, by name.
 */
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

/**
 * Whether moving the phase dates (`moved`, planned without the dates kept) gives back what keeping
 * them costs (`kept`): more lessons by the goal's date, job search work they leave out (even when
 * the plan then covers a few minutes less in all: a career's session end trimmed interviews and no
 * card offered them back, R13), another day for a challenge held on a day without room for it, or
 * a challenge after the lessons it tests. Today proposes the move only then.
 */
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

/**
 * Whether moving the phase dates does something the card can name: an end that moves, job search
 * work it fits in, or lessons it adds by the goal's date. Minutes gained inside lessons alone (the
 * move planned from today, where this week took a little less) moved nothing the learner sees,
 * and Today proposed it with nothing to say.
 */
export function showsPhaseDatesMove(
  effect: Pick<PlanEffect, "lessonsAdded" | "outcomesAdded" | "phaseEnds">,
): boolean {
  return (
    effect.lessonsAdded > 0 ||
    (effect.phaseEnds ?? []).length > 0 ||
    (effect.outcomesAdded ?? []).length > 0
  );
}

/**
 * The phases whose end a plan (`after`) moves from the end the learner saw, by name: one whose
 * challenge stayed on a day they rest says so (`resting`, see `listStrainedEnds`). The last phase
 * ends with the plan, which the card says on its own.
 */
export function listPhaseEndMoves({
  after,
  lessonsFirst = new Set(),
  resting = new Set(),
  shown,
}: {
  after: readonly Pick<PlanPhase, "endDate">[];
  /** Phases whose challenge came before lessons it tests (see `listEndsBeforeLessons`). */
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

/**
 * What moving the phase dates does beyond the lessons, so the learner who keeps their dates knows
 * what they keep them over: each phase end that moves, and the goal's outcome skills (a career's
 * job search) keeping the dates leaves out by the goal's date that moving them fits in.
 */
export function getPhaseDatesEffect({
  graph,
  kept,
  moved,
  shown,
}: {
  graph: Pick<PlanGraph, "skills">;
  kept: Pick<BuiltPlan, "droppedSkillIds" | "endsBeforeLessons" | "strainedEnds">;
  moved: Pick<BuiltPlan, "droppedSkillIds" | "phases">;
  /** The phases as the learner sees them. */
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

/**
 * Whether the learner already kept their dates over what moving them would give back now: the
 * proposal they declined named every job search skill, every challenge on a rest day and every
 * challenge before its lessons this one does. "Keep mine" is an informed choice over what the card said: kept over a challenge on a rest
 * day, the dates later left a career's job search out, and Today never asked again (R13).
 */
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

/**
 * Where moving the phase dates puts the phase ends a run kept (`ends`, by phase): the smallest move
 * (lead, 10 Oct). Only an end whose challenge has no room on its day moves, to the first later day
 * with room (see `listStrainedEnds`): on a day with time that two challenges overload, the later
 * one. A later end it would pass comes to the same day, so the phases stay in order (R39), and
 * every other end the learner saw stays. Planned again as the lessons fell, a phase's end slipped
 * five weeks, and the ends beside it moved a day.
 */
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

/**
 * How moving the phase dates is planned: as the run that kept them (`mode`), except that an
 * automatic run keeps this week as the learner saw it, its challenges too, so a move of an end
 * this week is planned from today, as the learner's own change is. Kept with the week, a challenge
 * stayed before the lessons it tests.
 */
export function getPhaseDatesMoveMode({
  kept,
  mode,
  shown,
  today,
}: {
  kept: Pick<BuiltPlan, "endsBeforeLessons" | "strainedEnds">;
  mode: PlanningMode;
  /** The phase ends the learner saw (see `getShownPhaseEnds`). */
  shown: ReadonlyMap<number, Date>;
  today: Date;
}): PlanningMode {
  const weekEnd = getEndOfWeek(today);
  const moving = [...kept.endsBeforeLessons, ...kept.strainedEnds.map((end) => end.phase)];
  const date = (phase: number) => shown.get(phase);

  return moving.some((phase) => (date(phase) ?? weekEnd) <= weekEnd) ? "forced" : mode;
}

/**
 * The phase ends a run kept (`kept`, the ones the learner saw) that it moved anyway, so the plan
 * says so: a phase's challenge never comes before or on the day of lessons it tests, so a lesson
 * that no longer ends by the day before takes the end with it (see `keepPhaseEnd`).
 */
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
