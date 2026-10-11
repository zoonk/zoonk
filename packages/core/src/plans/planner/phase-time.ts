import { type PlannedItem } from "./plan-items";

/** The items a phase studies: its challenge closes them. */
const LEARN_KINDS = new Set<PlannedItem["kind"]>(["boss", "chapter", "lesson"]);

/**
 * The phases whose challenge the learner won while some of their lessons are still to do: the
 * challenge holds its phase's end all the same (see `getShownPhaseEnds`).
 */
export function listWonPhases(
  items: readonly Pick<PlannedItem, "kind" | "phase" | "status">[],
): Set<number> {
  const studying = new Set(
    items.flatMap((item) =>
      item.kind !== "boss" && LEARN_KINDS.has(item.kind) && item.status === "todo"
        ? [item.phase]
        : [],
    ),
  );

  return new Set(
    items.flatMap((item) =>
      item.kind === "boss" && item.status === "done" && studying.has(item.phase)
        ? [item.phase]
        : [],
    ),
  );
}

/**
 * When each learn phase but the last ends: the day of its challenge, which closes its main work,
 * or the end the learner saw (`kept`) of one they won early, whose lessons are still the phase's
 * own (a run from today dates a challenge won ahead today). A phase without a dated challenge has
 * no end of its own.
 */
function getPhaseEnds({
  items,
  kept,
}: {
  items: readonly PlannedItem[];
  kept: ReadonlyMap<number, Date>;
}): Map<number, number> {
  const lastPhase = Math.max(0, ...items.map((item) => item.phase));
  const won = listWonPhases(items);

  return new Map(
    items.flatMap((item) => {
      const held = won.has(item.phase) ? kept.get(item.phase) : undefined;
      const date = held ?? item.scheduledFor;

      return item.kind === "boss" && item.phase < lastPhase && date
        ? [[item.phase, date.getTime()] as const]
        : [];
    }),
  );
}

/**
 * The phases with work of their own still to do: a phase a test-out finished has none, and its
 * dates stay those of its finished items.
 */
function listPhasesToStudy(items: readonly PlannedItem[]): Set<number> {
  return new Set(
    items.flatMap((item) =>
      item.status === "todo" && LEARN_KINDS.has(item.kind) ? [item.phase] : [],
    ),
  );
}

/**
 * The phase whose time a day falls in, from `phase` on: the first still to study that hasn't ended
 * by then.
 */
function findPhaseOfDay({
  ends,
  lastPhase,
  phase,
  studied,
  time,
}: {
  ends: ReadonlyMap<number, number>;
  lastPhase: number;
  phase: number;
  studied: ReadonlySet<number>;
  time: number;
}): number {
  const later = Array.from(
    { length: Math.max(0, lastPhase - phase) },
    (_, index) => phase + 1 + index,
  );

  return (
    later.find((next) => studied.has(next) && (ends.get(next) ?? Infinity) >= time) ?? lastPhase
  );
}

/**
 * A learn phase spans its main work: its lessons up to its challenge, which closes it. What's due
 * after that challenge (the depth a plan short on time studies once every phase's core is in, and
 * the weekly challenges among it) belongs to the phase whose time it falls in, as an exam's
 * lessons belong to the phase of the day they're due. So a phase's dates say when its work
 * happens, the phase the learner is in follows the calendar, and a few late lessons never stretch
 * a phase over the ones after it. Finished items and challenges keep their phase, and a phase with
 * nothing of its own left to study takes none of it: a career's portfolio phase a test-out
 * finished took every lesson a slower pace left after the UX process challenge, and its end moved
 * ten days.
 */
export function placeItemsInPhaseTime({
  items,
  kept = new Map(),
}: {
  items: readonly PlannedItem[];
  /** The phase ends the run keeps, the ones the learner saw (see `getShownPhaseEnds`). */
  kept?: ReadonlyMap<number, Date>;
}): PlannedItem[] {
  const ends = getPhaseEnds({ items, kept });
  const lastPhase = Math.max(0, ...items.map((item) => item.phase));
  const studied = listPhasesToStudy(items);

  return items.map((item) => {
    const end = ends.get(item.phase);
    const time = item.scheduledFor?.getTime();

    if (item.kind === "boss" || item.status !== "todo" || !time || !end || time <= end) {
      return item;
    }

    return {
      ...item,
      phase: findPhaseOfDay({ ends, lastPhase, phase: item.phase, studied, time }),
    };
  });
}
