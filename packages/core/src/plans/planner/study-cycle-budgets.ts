import { type CycleContext, type CycleState, type Lane, isUnitReady } from "./study-cycle-lanes";

/** Floating-point sums of minutes must not make a lesson look due a day early. */
const EPSILON = 1e-6;

/**
 * The minutes a subject needs on this day to reach the next lesson of the chapter the learner is in
 * the middle of, which the plan they see has on this day or before (see `QueueUnit.dueBy`): that
 * lesson and the subject's lessons before it. 0 when the subject holds no such lesson.
 */
export function getDueMinutes({ date, lane }: { date: Date | undefined; lane: Lane }): number {
  if (!date || lane.dueUnits.length === 0) {
    return 0;
  }

  const due = lane.dueUnits.filter((unit) => unit.dueBy && unit.dueBy.getTime() <= date.getTime());

  const index = due.reduce((first, unit) => {
    const current = lane.units.indexOf(unit);
    return current === -1 ? first : Math.min(first, current);
  }, Infinity);

  if (index === Infinity) {
    return 0;
  }

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
  dateOf,
  left,
}: {
  chosen: readonly Lane[];
  date: Date | undefined;
  /** The day a subject's due lessons count by, when not `date` (see `getDueDate`). */
  dateOf?: (lane: Lane) => Date | undefined;
  left: number;
}): Map<Lane, number> {
  const worth = chosen.reduce((total, lane) => total + lane.rate, 0);

  const shares = chosen.map((lane) => ({
    due: getDueMinutes({ date: dateOf?.(lane) ?? date, lane }),
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
  dateOf,
}: {
  chosen: readonly Lane[];
  date: Date | undefined;
  /** The day a subject's due lessons count by, when not `date` (see `getDueDate`). */
  dateOf?: (lane: Lane) => Date | undefined;
}): Map<Lane, number> {
  return new Map(
    chosen.map((lane, index) => [
      lane,
      chosen
        .slice(index + 1)
        .reduce(
          (total, later) => total + getDueMinutes({ date: dateOf?.(later) ?? date, lane: later }),
          0,
        ),
    ]),
  );
}

/**
 * The day a subject's due lessons count by on this day (see `getDueMinutes`): this day, or the day
 * the learner saw the chapter in progress's next lesson on when, after one lesson of another
 * subject (`others`, the longest next one), the time until that day can't hold the minutes to
 * reach it. Then it starts now: on light days a lesson spans several, and the other subjects'
 * lessons begun first left "less Linguagens" two days late for its chapter (R10). It only ever
 * starts it sooner, in the plan's own time.
 */
function getDueDate({
  context,
  dayIndex,
  lane,
  others,
  used,
}: {
  context: CycleContext;
  dayIndex: number;
  lane: Lane;
  /** The longest next lesson of the other subjects ready now. */
  others: number;
  /** The lesson minutes the cycle placed so far. */
  used: number;
}): Date | undefined {
  const date = context.days[dayIndex]?.date;
  const unit = lane.dueUnits.find((due) => due.dueBy && lane.units.includes(due));
  const dueBy = unit?.dueBy;

  if (!date || !unit || !dueBy || dueBy <= date) {
    return date;
  }

  const dueIndex = context.days.findLastIndex((day) => day.date <= dueBy);

  const needed = lane.units
    .slice(0, lane.units.indexOf(unit) + 1)
    .reduce((total, item) => total + item.minutes, 0);

  const later = Math.max(used + others, context.cumulative[dayIndex - 1] ?? 0);
  const left = (context.cumulative[dueIndex] ?? 0) - later;

  return left + EPSILON < needed ? dueBy : date;
}

/**
 * Each subject's due date on this day (see `getDueDate`), after the longest next lesson of the
 * other subjects ready now, which one due later may wait behind.
 */
export function toDueDates({
  context,
  dayIndex,
  state,
}: {
  context: CycleContext;
  dayIndex: number;
  state: CycleState;
}): (lane: Lane) => Date | undefined {
  const heads = new Map(
    state.lanes.map((lane) => {
      const head = lane.units[0];
      const ready = head && isUnitReady({ context, left: state.left, unit: head });
      return [lane, ready ? head.minutes : 0];
    }),
  );

  return (lane) =>
    getDueDate({
      context,
      dayIndex,
      lane,
      others: Math.max(
        0,
        ...[...heads].flatMap(([other, minutes]) => (other === lane ? [] : [minutes])),
      ),
      used: state.used,
    });
}
