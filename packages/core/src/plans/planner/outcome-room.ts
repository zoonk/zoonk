import { type QueueUnit } from "./plan-units";

type OutcomeRoom = { kept: QueueUnit[]; leftOut: QueueUnit[] };

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

/**
 * The largest count in [low, high] that `works`, or null; `works` must only shrink as `count`
 * grows.
 */
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

function isKeptOutcome(unit: QueueUnit): boolean {
  return unit.outcome === true && !unit.depth;
}

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

export function closeWhatFits({
  fits,
  placed,
  units,
}: {
  fits: (units: readonly QueueUnit[]) => boolean;
  placed: readonly { dayIndex: number }[];
  units: readonly QueueUnit[];
}): OutcomeRoom {
  const closing = units.at(-1);
  const before = units.slice(0, -1);
  const unchanged = { kept: [...units], leftOut: [] };

  if (closing?.kind !== "boss" || placed.every(({ dayIndex }) => dayIndex >= 0)) {
    return unchanged;
  }

  const fitting = placed.slice(0, -1).filter(({ dayIndex }) => dayIndex >= 0);

  const count = findLargestCount({
    high: fitting.length,
    low: 0,
    works: (fitted) => fits([...before.slice(0, fitted), closing]),
  });

  if (count === null) {
    return unchanged;
  }

  const kept = before.slice(0, count);
  const reachesPhase = kept.some((unit) => unit.kind === "lesson" && unit.phase === closing.phase);
  const takesOnlyDepth = before.slice(count, fitting.length).every((unit) => unit.depth);

  return reachesPhase && takesOnlyDepth
    ? { kept: [...kept, closing], leftOut: before.slice(count) }
    : unchanged;
}
