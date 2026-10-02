import { type QueueUnit } from "./plan-units";

/**
 * An exam day mixes areas in short runs: about 15 minutes of one area's lessons at a time, enough
 * to follow one idea and short enough that a day reaches several areas.
 */
const RUN_MINUTES = 15;

/** Floating-point sums of lesson minutes must not end a run a lesson early. */
const EPSILON = 1e-6;

/** An area whose skills are worth nothing right now still gets its turn, last. */
const MIN_RATE = 1e-6;

/**
 * One area's lessons still to place, in teaching order, and the time it has had so far divided by
 * its rate: the area with the least of it goes next (stride scheduling).
 */
type Lane = { order: number; pass: number; units: readonly QueueUnit[] };

type MixState = {
  lanes: readonly Lane[];
  /** Lessons still to place per skill: a skill is done once none are left. */
  left: ReadonlyMap<string, number>;
  mixed: QueueUnit[];
};

type MixContext = {
  prerequisites: ReadonlyMap<string, readonly string[]>;
  rates: ReadonlyMap<string, number>;
};

function toLanes(units: readonly QueueUnit[]): Lane[] {
  const areas = [...new Set(units.map((unit) => unit.area))];

  return areas.map((area, order) => ({
    order,
    pass: 0,
    units: units.filter((unit) => unit.area === area),
  }));
}

function countBySkill(units: readonly QueueUnit[]): Map<string, number> {
  return units.reduce((counts, unit) => {
    if (unit.skillId) {
      counts.set(unit.skillId, (counts.get(unit.skillId) ?? 0) + 1);
    }

    return counts;
  }, new Map<string, number>());
}

/** A lane can go once every prerequisite of its next skill that this mix places is placed. */
function isReady({
  context,
  lane,
  left,
}: {
  context: MixContext;
  lane: Lane;
  left: ReadonlyMap<string, number>;
}): boolean {
  const skillId = lane.units[0]?.skillId;

  if (!skillId) {
    return true;
  }

  return (context.prerequisites.get(skillId) ?? []).every(
    (id) => id === skillId || (left.get(id) ?? 0) === 0,
  );
}

/** The next lessons of one skill and chapter, up to a run's minutes; always at least one. */
function takeRun(units: readonly QueueUnit[]): readonly QueueUnit[] {
  const [head] = units;

  if (!head) {
    return [];
  }

  const end = units.findIndex(
    (unit) => unit.skillId !== head.skillId || unit.chapterId !== head.chapterId,
  );

  const sameIdea = end === -1 ? units : units.slice(0, end);

  const fitting = sameIdea
    .reduce<number[]>((sums, unit) => {
      sums.push((sums.at(-1) ?? 0) + unit.minutes);
      return sums;
    }, [])
    .filter((total) => total <= RUN_MINUTES + EPSILON).length;

  return sameIdea.slice(0, Math.max(1, fitting));
}

function getRate({ context, lane }: { context: MixContext; lane: Lane }): number {
  const skillId = lane.units[0]?.skillId;
  return Math.max(MIN_RATE, skillId ? (context.rates.get(skillId) ?? 1) : 1);
}

function getFinish({ context, lane }: { context: MixContext; lane: Lane }): number {
  const minutes = takeRun(lane.units).reduce((total, unit) => total + unit.minutes, 0);
  return lane.pass + minutes / getRate({ context, lane });
}

/**
 * The lane that goes next: the ready one that would finish its run first. When a prerequisite
 * cycle leaves none ready, the earliest lane goes, so the plan never stalls.
 */
function pickLane({ context, state }: { context: MixContext; state: MixState }): Lane | null {
  const open = state.lanes.filter((lane) => lane.units.length > 0);
  const ready = open.filter((lane) => isReady({ context, lane, left: state.left }));

  const ranked = ready
    .map((lane) => ({ finish: getFinish({ context, lane }), lane }))
    .toSorted((a, b) => a.finish - b.finish || a.lane.order - b.lane.order);

  return ranked[0]?.lane ?? open[0] ?? null;
}

/**
 * A lane that had to wait for a prerequisite doesn't save up time meanwhile, so it rejoins the mix
 * instead of filling whole days once it can go.
 */
function moveLane({
  chosen,
  context,
  lane,
  run,
  state,
}: {
  chosen: Lane;
  context: MixContext;
  lane: Lane;
  run: readonly QueueUnit[];
  state: MixState;
}): Lane {
  if (lane === chosen) {
    return { ...lane, pass: getFinish({ context, lane }), units: lane.units.slice(run.length) };
  }

  const waiting = lane.units.length > 0 && !isReady({ context, lane, left: state.left });

  return waiting ? { ...lane, pass: Math.max(lane.pass, chosen.pass) } : lane;
}

function placeNextRun({ context, state }: { context: MixContext; state: MixState }): MixState {
  const chosen = pickLane({ context, state });

  if (!chosen) {
    return state;
  }

  const run = takeRun(chosen.units);
  const left = new Map(state.left);

  run.forEach((unit) => {
    if (unit.skillId) {
      left.set(unit.skillId, (left.get(unit.skillId) ?? 1) - 1);
    }
  });

  state.mixed.push(...run);

  return {
    lanes: state.lanes.map((lane) => moveLane({ chosen, context, lane, run, state })),
    left,
    mixed: state.mixed,
  };
}

/**
 * Interleaves lessons in teaching order across their areas, so one exam day isn't twenty lessons
 * of one subject: each area gets time in proportion to its rate (what its next skill is worth),
 * in runs of a few lessons from one chapter. Each area keeps its own order, and a skill starts
 * only after every prerequisite in the list is placed.
 */
export function mixAreas({
  prerequisites,
  rates,
  units,
}: {
  prerequisites: ReadonlyMap<string, readonly string[]>;
  /** What each skill is worth per minute of study, relative to the others. */
  rates: ReadonlyMap<string, number>;
  units: readonly QueueUnit[];
}): QueueUnit[] {
  const context = { prerequisites, rates };
  const initial: MixState = { lanes: toLanes(units), left: countBySkill(units), mixed: [] };

  return units.reduce((state) => placeNextRun({ context, state }), initial).mixed;
}
