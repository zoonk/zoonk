import { type PlannedItem } from "./plan-items";

const LEARN_KINDS = new Set<PlannedItem["kind"]>(["boss", "chapter", "lesson"]);

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

function listPhasesToStudy(items: readonly PlannedItem[]): Set<number> {
  return new Set(
    items.flatMap((item) =>
      item.status === "todo" && LEARN_KINDS.has(item.kind) ? [item.phase] : [],
    ),
  );
}

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

export function placeItemsInPhaseTime({
  items,
  kept = new Map(),
}: {
  items: readonly PlannedItem[];
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
