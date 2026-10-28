import { type CycleContext, type CycleState, type Lane, isUnitReady } from "./study-cycle-lanes";

const EPSILON = 1e-6;

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

export function isDue({ date, lane }: { date: Date | undefined; lane: Lane }): boolean {
  return getDueMinutes({ date, lane }) > 0;
}

export function getBudgets({
  chosen,
  date,
  dateOf,
  left,
}: {
  chosen: readonly Lane[];
  date: Date | undefined;
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

export function getReserves({
  chosen,
  date,
  dateOf,
}: {
  chosen: readonly Lane[];
  date: Date | undefined;
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
  others: number;
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
