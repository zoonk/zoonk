import { type PlanOperation } from "../plan-contract";
import { isAreaOperation } from "../planner/area-operations";
import {
  type AreaEnd,
  type AreaLessons,
  type AreaStart,
  type AreaTopics,
  type PlanEffect,
} from "../planner/plan-effect";

type PartAreas = ReadonlyMap<string, string>;

/** The name an area goes by among the ones listed with it: its whole's, when that's listed too. */
function toShownArea({
  area,
  listed,
  partAreas,
}: {
  area: string;
  listed: readonly string[];
  partAreas: PartAreas;
}): string {
  const whole = partAreas.get(area);
  return whole && listed.includes(whole) ? whole : area;
}

function foldNames({ names, partAreas }: { names: string[]; partAreas: PartAreas }): string[] {
  return names.filter((area) => toShownArea({ area, listed: names, partAreas }) === area);
}

/** One entry per area as shown: a part's entry merges into its whole's when the whole has one. */
function foldEntries<T extends { area: string }>({
  entries,
  merge,
  partAreas,
}: {
  entries: T[];
  merge: (whole: T, part: T) => T;
  partAreas: PartAreas;
}): T[] {
  const listed = entries.map((entry) => entry.area);

  const groups = Map.groupBy(entries, (entry) =>
    toShownArea({ area: entry.area, listed, partAreas }),
  );

  return [...groups].flatMap(([area, group]) => {
    const whole = group.find((entry) => entry.area === area);
    const parts = group.filter((entry) => entry !== whole);
    return whole ? [parts.reduce((merged, part) => merge(merged, part), whole)] : group;
  });
}

const later = (first: string, second: string) => (first > second ? first : second);

function earlier(first: string | null, second: string | null): string | null {
  if (first === null || second === null) {
    return first ?? second;
  }

  return first < second ? first : second;
}

/** A subject ends when its last part does, with the lessons its parts gain together. */
function mergeEnds(whole: AreaEnd, part: AreaEnd): AreaEnd {
  const gained = (whole.lessonsGained ?? 0) + (part.lessonsGained ?? 0);

  return {
    after: later(whole.after, part.after),
    area: whole.area,
    before: later(whole.before, part.before),
    ...(gained !== 0 && { lessonsGained: gained }),
  };
}

/** A subject starts when its first part does. */
const mergeStarts = (whole: AreaStart, part: AreaStart): AreaStart => ({
  after: earlier(whole.after, part.after),
  area: whole.area,
  before: earlier(whole.before, part.before),
});

const mergeLessons = (whole: AreaLessons, part: AreaLessons): AreaLessons => ({
  after: whole.after + part.after,
  area: whole.area,
  before: whole.before + part.before,
});

const mergeTopics = (whole: AreaTopics, part: AreaTopics): AreaTopics => ({
  area: whole.area,
  topics: [...whole.topics, ...part.topics],
});

function foldEffect({
  effect,
  partAreas,
}: {
  effect: PlanEffect;
  partAreas: PartAreas;
}): PlanEffect {
  const { areaEnds, areaLessons, areaStarts, reviewFirst, topicsAdded, topicsLeftOut } = effect;

  return {
    ...effect,
    ...(areaEnds && { areaEnds: foldEntries({ entries: areaEnds, merge: mergeEnds, partAreas }) }),
    ...(areaLessons && {
      areaLessons: foldEntries({ entries: areaLessons, merge: mergeLessons, partAreas }),
    }),
    ...(areaStarts && {
      areaStarts: foldEntries({ entries: areaStarts, merge: mergeStarts, partAreas }),
    }),
    ...(reviewFirst && {
      reviewFirst: { ...reviewFirst, areas: foldNames({ names: reviewFirst.areas, partAreas }) },
    }),
    ...(topicsAdded && {
      topicsAdded: foldEntries({ entries: topicsAdded, merge: mergeTopics, partAreas }),
    }),
    ...(topicsLeftOut && {
      topicsLeftOut: foldEntries({ entries: topicsLeftOut, merge: mergeTopics, partAreas }),
    }),
  };
}

/**
 * A change as learners see its areas: an area that's part of another (the foreign language an ENEM
 * candidate takes, inside the languages area; see `findPartAreas`) goes by that area's name
 * wherever both are named, its lines merged into that area's (the later end, the earlier start,
 * the lessons and topics together), as the syllabus shows it. A part named alone keeps its name.
 */
export function foldChangeAreas<
  T extends { effect: PlanEffect | null; operations: PlanOperation[] },
>({ change, partAreas }: { change: T; partAreas: PartAreas }): T {
  if (partAreas.size === 0) {
    return change;
  }

  return {
    ...change,
    effect: change.effect && foldEffect({ effect: change.effect, partAreas }),
    operations: change.operations.map((operation) =>
      isAreaOperation(operation)
        ? { ...operation, areas: foldNames({ names: operation.areas, partAreas }) }
        : operation,
    ),
  };
}
