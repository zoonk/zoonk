import { type Lane } from "./study-cycle-lanes";

/**
 * The minutes a subject needs on this day to reach the next lesson of the chapter the learner is in
 * the middle of, which the plan they see has on this day or before (see `QueueUnit.dueBy`): that
 * lesson and the subject's lessons before it. 0 when the subject holds no such lesson.
 */
function getDueMinutes({ date, lane }: { date: Date | undefined; lane: Lane }): number {
  const index = lane.units.findIndex(
    (unit) => date && unit.dueBy && unit.dueBy.getTime() <= date.getTime(),
  );

  return lane.units.slice(0, index + 1).reduce((total, unit) => total + unit.minutes, 0);
}

/** Whether the subject holds the chapter in progress's next lesson, due by this day. */
export function isDue({ date, lane }: { date: Date | undefined; lane: Lane }): boolean {
  return getDueMinutes({ date, lane }) > 0;
}

/**
 * Each chosen subject's share of the day's lesson time (`left`), in proportion to what it's worth;
 * the subject of the chapter in progress gets at least the time to reach its next lesson by the day
 * the learner saw it on (`getDueMinutes`), and the others share the rest. Câmara's focus on
 * constitutional law shrank political science's block by a lesson, and its chapter's next lesson
 * went a day later (R10).
 */
export function getBudgets({
  chosen,
  date,
  left,
}: {
  chosen: readonly Lane[];
  date: Date | undefined;
  left: number;
}): Map<Lane, number> {
  const worth = chosen.reduce((total, lane) => total + lane.rate, 0);

  const shares = chosen.map((lane) => ({
    due: getDueMinutes({ date, lane }),
    lane,
    share: (left * lane.rate) / worth,
  }));

  const extra = shares.reduce((total, { due, share }) => total + Math.max(0, due - share), 0);
  const free = shares.reduce((total, { due, share }) => total + (due > 0 ? 0 : share), 0);
  const scale = free > 0 ? Math.max(0, free - extra) / free : 1;

  return new Map(
    shares.map(({ due, lane, share }) => [lane, due > 0 ? Math.max(due, share) : share * scale]),
  );
}

/**
 * The minutes each chosen subject leaves of the day for the subjects after it that hold the
 * chapter in progress's next lesson (`getDueMinutes`): a subject before them takes at least one
 * lesson when it fits, and Câmara's focused constitutional law took the day's last minutes that
 * political science's next lesson needed.
 */
export function getReserves({
  chosen,
  date,
}: {
  chosen: readonly Lane[];
  date: Date | undefined;
}): Map<Lane, number> {
  return new Map(
    chosen.map((lane, index) => [
      lane,
      chosen
        .slice(index + 1)
        .reduce((total, later) => total + getDueMinutes({ date, lane: later }), 0),
    ]),
  );
}
