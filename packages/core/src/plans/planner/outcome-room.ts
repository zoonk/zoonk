import { type QueueUnit } from "./plan-units";

type OutcomeRoom = { kept: QueueUnit[]; leftOut: QueueUnit[] };

/**
 * The units with only the first `count` of the other lessons: the rest are left out, and so is a
 * phase checkpoint whose phase has no lesson left. Units are told apart as they are, not by key:
 * a stand-in's parts share its key (its core early, its depth after every core), and leaving out
 * its depth took its core out of the plan too.
 */
function keepFirstOthers({
  count,
  others,
  units,
}: {
  count: number;
  others: readonly QueueUnit[];
  units: readonly QueueUnit[];
}): OutcomeRoom {
  const leftOutLessons = new Set(others.slice(count));
  const lessons = units.filter((unit) => !leftOutLessons.has(unit));

  const phases = new Set(
    lessons.filter((unit) => unit.kind === "lesson").map((unit) => unit.phase),
  );

  const kept = lessons.filter((unit) => unit.kind !== "boss" || phases.has(unit.phase));
  const keptUnits = new Set(kept);

  return { kept, leftOut: units.filter((unit) => !keptUnits.has(unit)) };
}

/** The largest count in [low, high] that `works`, or null when none does (it shrinks as `count` grows). */
export function findLargestCount({
  high,
  low,
  works,
}: {
  high: number;
  low: number;
  works: (count: number) => boolean;
}): number | null {
  if (low > high) {
    return null;
  }

  const middle = Math.ceil((low + high) / 2);

  return works(middle)
    ? (findLargestCount({ high, low: middle + 1, works }) ?? middle)
    : findLargestCount({ high: middle - 1, low, works });
}

/** An outcome lesson the plan keeps: a skill's depth (an exam's written test past its core) isn't one. */
function isKeptOutcome(unit: QueueUnit): boolean {
  return unit.outcome === true && !unit.depth;
}

/**
 * A plan that can't fit everything before its end keeps the goal's outcome skills whole (a career
 * change's portfolio and job search, which get the learner the job; an exam's written test, its
 * core) and leaves out other lessons instead: the ones the path reaches last, its deepest
 * material, as many as it takes to make room. `dropsOutcome` says whether laying the units on the
 * plan's days leaves a kept outcome lesson out. When the outcomes alone don't fit, nothing
 * changes: the plan is cut at its end as usual.
 */
export function makeRoomForOutcomes({
  dropsOutcome,
  units,
}: {
  dropsOutcome: (units: readonly QueueUnit[]) => boolean;
  units: readonly QueueUnit[];
}): OutcomeRoom {
  const unchanged = { kept: [...units], leftOut: [] };

  if (!units.some((unit) => isKeptOutcome(unit)) || !dropsOutcome(units)) {
    return unchanged;
  }

  const others = units.filter((unit) => unit.kind === "lesson" && !isKeptOutcome(unit));

  const count = findLargestCount({
    high: others.length - 1,
    low: 0,
    works: (kept) => !dropsOutcome(keepFirstOthers({ count: kept, others, units }).kept),
  });

  return count === null ? unchanged : keepFirstOthers({ count, others, units });
}
