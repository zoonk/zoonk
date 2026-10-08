import { type PlannedItem } from "./plan-items";

/**
 * When each learn phase but the last ends: the day of its challenge, which closes its main work.
 * A phase without a dated challenge has no end of its own.
 */
function getPhaseEnds(items: readonly PlannedItem[]): Map<number, number> {
  const lastPhase = Math.max(0, ...items.map((item) => item.phase));

  return new Map(
    items.flatMap((item) =>
      item.kind === "boss" && item.phase < lastPhase && item.scheduledFor
        ? [[item.phase, item.scheduledFor.getTime()] as const]
        : [],
    ),
  );
}

/** The phase whose time a day falls in, from `phase` on: the first that hasn't ended by then. */
function findPhaseOfDay({
  ends,
  lastPhase,
  phase,
  time,
}: {
  ends: ReadonlyMap<number, number>;
  lastPhase: number;
  phase: number;
  time: number;
}): number {
  const later = Array.from(
    { length: Math.max(0, lastPhase - phase) },
    (_, index) => phase + 1 + index,
  );

  return later.find((next) => (ends.get(next) ?? Infinity) >= time) ?? lastPhase;
}

/**
 * A learn phase spans its main work: its lessons up to its challenge, which closes it. What's due
 * after that challenge (the depth a plan short on time studies once every phase's core is in, and
 * the weekly challenges among it) belongs to the phase whose time it falls in, as an exam's
 * lessons belong to the phase of the day they're due. So a phase's dates say when its work
 * happens, the phase the learner is in follows the calendar, and a few late lessons never stretch
 * a phase over the ones after it. Finished items and challenges keep their phase.
 */
export function placeItemsInPhaseTime(items: readonly PlannedItem[]): PlannedItem[] {
  const ends = getPhaseEnds(items);
  const lastPhase = Math.max(0, ...items.map((item) => item.phase));

  return items.map((item) => {
    const end = ends.get(item.phase);
    const time = item.scheduledFor?.getTime();

    if (item.kind === "boss" || item.status !== "todo" || !time || !end || time <= end) {
      return item;
    }

    return { ...item, phase: findPhaseOfDay({ ends, lastPhase, phase: item.phase, time }) };
  });
}
