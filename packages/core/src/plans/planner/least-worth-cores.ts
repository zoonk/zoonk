import { type QueueUnit } from "./plan-units";
import { type Worth, isCutCore, rankShortAreas } from "./rank-cores";

/** Each area's core minutes that didn't fit before the deadline. */
function sumMissingCores(dropped: readonly QueueUnit[]): Map<string, number> {
  return dropped
    .filter((unit) => isCutCore(unit))
    .reduce(
      (areas, unit) => areas.set(unit.area, (areas.get(unit.area) ?? 0) + unit.minutes),
      new Map<string, number>(),
    );
}

/**
 * The plan's units with an area's cores in the order it keeps them, when even every skill's core
 * doesn't fit before the deadline. Each area keeps, in the time its cores had, the topics the exam
 * asks most, then the ones asked less, then second cores of a topic (see `rankCores`), and the
 * rest go last in that order: the deadline cuts the least asked, and the first one cut fits in
 * part, which keeps its topic in the plan. The ones it keeps go in that order too, so when the
 * days hold less than the first schedule did, the deadline still cuts the least asked of them:
 * kept in teaching order, Câmara's linguistics lost the topic its learner missed, which came late
 * in it, and kept one asked as often. Laid out in teaching order, a plan short on time left out
 * what its areas' later phases reach (an ENEM's genetics and organic chemistry); ranked by topics
 * per minute, it left out the big topics asked most (mechanics, heat) for small ones nobody
 * ranked. Null when every core fits.
 */
function putLeastWorthCoresLast({
  missing,
  units,
  worth,
}: {
  /** Each area's core minutes a first schedule of `units` couldn't fit (see `sumMissingCores`). */
  missing: ReadonlyMap<string, number>;
  /** The plan's units, every core first (see `putCoresFirst`). */
  units: readonly QueueUnit[];
  worth: Worth;
}): QueueUnit[] | null {
  if (missing.size === 0) {
    return null;
  }

  const ranked = rankShortAreas({ missing, units, worth });

  // Each area's cores with their place in its order, the ones it keeps first, so the deadline
  // cuts the last of them.
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

  // The ones it leaves out say so, so a skill of another subject that builds on one of them doesn't
  // bring it ahead of the cores this subject keeps (see `pullPrerequisites`).
  const ordered = cores
    .filter((unit) => isRanked(unit))
    .toSorted((a, b) => placeOf(a) - placeOf(b))
    .map((unit) => (rankedOut.has(unit.skillId ?? "") ? { ...unit, rankedOut: true } : unit));

  return [...cores.filter((unit) => !isRanked(unit)), ...ordered, ...units.slice(coreEnd)];
}

/**
 * The keys of the work earlier days left (`carried`, see `placeCarriedWork`) that gives way when
 * even the cores don't fit: it goes first, as it was planned, but ranks with the rest of its area's
 * cores (see `rankCores`), so a carried core the ranking cuts leaves the carry, and so does carried
 * depth in an area short on cores. Never the chapter in progress or an outcome's lessons (see
 * `isCutCore`). Carried first whatever their topic, the three days Câmara's learner missed at 180
 * minutes, cut to 15 a day, kept a linguistics topic asked as often as the one they had missed,
 * which left.
 */
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

/**
 * A plan short on time, every skill's core first, laid out by `schedulePending`. When even the
 * cores don't fit, an exam's cores the deadline cuts are the ones worth least in each subject (see
 * `putLeastWorthCoresLast`), not the ones the teaching order reaches last, and `yielded` names the
 * work earlier days left that gives way to them (see `listYieldingCarried`). Other goals (`worth`
 * null) weigh their skills alike and follow their path: what it reaches last waits.
 */
export function scheduleCoresFirst<TSchedule extends { dropped: readonly QueueUnit[] }>({
  carried = [],
  schedulePending,
  units,
  worth,
}: {
  /** The work earlier days left, laid out before `units` (see `placeCarriedWork`). */
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
