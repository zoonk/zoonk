import { type QueueUnit } from "./plan-units";
import { type Worth, isCutCore, rankShortAreas } from "./rank-cores";

function sumMissingCores(dropped: readonly QueueUnit[]): Map<string, number> {
  return dropped
    .filter((unit) => isCutCore(unit))
    .reduce(
      (areas, unit) => areas.set(unit.area, (areas.get(unit.area) ?? 0) + unit.minutes),
      new Map<string, number>(),
    );
}

function putLeastWorthCoresLast({
  missing,
  units,
  worth,
}: {
  missing: ReadonlyMap<string, number>;
  units: readonly QueueUnit[];
  worth: Worth;
}): QueueUnit[] | null {
  if (missing.size === 0) {
    return null;
  }

  const ranked = rankShortAreas({ missing, units, worth });

  const places = new Map(
    ranked.flatMap(({ kept, order }) =>
      [
        ...order.filter((skillId) => kept.has(skillId)),
        ...order.filter((skillId) => !kept.has(skillId)),
      ].map((skillId, index) => [skillId, index] as const),
    ),
  );

  const rankedOut = new Set(
    ranked.flatMap(({ kept, order }) => order.filter((skillId) => !kept.has(skillId))),
  );

  const isRanked = (unit: QueueUnit) => isCutCore(unit) && places.has(unit.skillId);
  const placeOf = (unit: QueueUnit) => places.get(unit.skillId ?? "") ?? 0;
  const depthStart = units.findIndex((unit) => unit.depth);
  const coreEnd = depthStart === -1 ? units.length : depthStart;
  const cores = units.slice(0, coreEnd);

  const ordered = cores
    .filter((unit) => isRanked(unit))
    .toSorted((a, b) => placeOf(a) - placeOf(b))
    .map((unit) => (rankedOut.has(unit.skillId ?? "") ? { ...unit, rankedOut: true } : unit));

  return [...cores.filter((unit) => !isRanked(unit)), ...ordered, ...units.slice(coreEnd)];
}

function listYieldingCarried({
  carried,
  missing,
  units,
  worth,
}: {
  carried: readonly QueueUnit[];
  missing: ReadonlyMap<string, number>;
  units: readonly QueueUnit[];
  worth: Worth;
}): string[] {
  if (carried.length === 0 || missing.size === 0) {
    return [];
  }

  const kept = new Set(
    rankShortAreas({ missing, units: [...carried, ...units], worth }).flatMap((ranked) => [
      ...ranked.kept,
    ]),
  );

  const yields = (unit: QueueUnit) =>
    unit.depth
      ? unit.kind === "lesson" && !unit.outcome && !unit.inProgress
      : isCutCore(unit) && !kept.has(unit.skillId);

  return carried.filter((unit) => missing.has(unit.area) && yields(unit)).map((unit) => unit.key);
}

export function scheduleCoresFirst<TSchedule extends { dropped: readonly QueueUnit[] }>({
  carried = [],
  schedulePending,
  units,
  worth,
}: {
  carried?: readonly QueueUnit[];
  schedulePending: (units: readonly QueueUnit[]) => TSchedule;
  units: readonly QueueUnit[];
  worth: Worth | null;
}): TSchedule & { yielded: string[] } {
  const first = schedulePending(units);

  if (!worth) {
    return { ...first, yielded: [] };
  }

  const missing = sumMissingCores(first.dropped);
  const reordered = putLeastWorthCoresLast({ missing, units, worth });

  return {
    ...(reordered ? schedulePending(reordered) : first),
    yielded: listYieldingCarried({ carried, missing, units, worth }),
  };
}
