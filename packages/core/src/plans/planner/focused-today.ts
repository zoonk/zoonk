import { getOneDayStudy } from "./interval-study-minutes";
import { PLAN_EPSILON } from "./plan-precision";
import { type QueueUnit } from "./plan-units";
import { type PlanDay, type ScheduledUnit, getLessonCapacity } from "./schedule-units";

type TodayTaking = { open: boolean; started: Set<string>; taken: QueueUnit[]; used: number };

function isReady({
  prerequisites,
  started,
  unit,
  waiting,
}: {
  prerequisites: ReadonlyMap<string, readonly string[]>;
  started: ReadonlySet<string>;
  unit: QueueUnit;
  waiting: ReadonlySet<string>;
}): boolean {
  return (prerequisites.get(unit.skillId ?? "") ?? []).every(
    (baseId) => !waiting.has(baseId) || started.has(baseId),
  );
}

function takeIfReady({
  capacity,
  prerequisites,
  state,
  unit,
  waiting,
}: {
  capacity: number;
  prerequisites: ReadonlyMap<string, readonly string[]>;
  state: TodayTaking;
  unit: QueueUnit;
  waiting: ReadonlySet<string>;
}): TodayTaking {
  if (!state.open || !isReady({ prerequisites, started: state.started, unit, waiting })) {
    return state;
  }

  if (state.used + unit.minutes > capacity + PLAN_EPSILON) {
    state.open = false;
    return state;
  }

  state.taken.push(unit);
  state.started.add(unit.skillId ?? "");
  state.used += unit.minutes;
  return state;
}

export function takeFocusedToday({
  begun,
  days,
  prerequisites,
  units,
}: {
  begun: ReadonlySet<string>;
  days: readonly PlanDay[];
  prerequisites: ReadonlyMap<string, readonly string[]>;
  units: readonly QueueUnit[];
}): { days: PlanDay[]; rest: QueueUnit[]; today: ScheduledUnit[] } {
  const [first, ...later] = days;

  if (!first) {
    return { days: [], rest: [...units], today: [] };
  }

  const capacity = getLessonCapacity(first);
  const waiting = new Set(units.flatMap((unit) => (unit.skillId ? [unit.skillId] : [])));

  const { taken } = units
    .filter((unit) => unit.kind === "lesson" && unit.focused)
    .reduce<TodayTaking>(
      (state, unit) => takeIfReady({ capacity, prerequisites, state, unit, waiting }),
      { open: true, started: new Set(begun), taken: [], used: 0 },
    );

  const takenSet = new Set(taken);
  const reserved = (first.shape.reserved ?? 0) + capacity;

  return {
    days: [{ ...first, shape: { ...first.shape, reserved } }, ...later],
    rest: units.filter((unit) => !takenSet.has(unit)),
    today: taken.map((unit) => ({
      ...unit,
      date: first.date,
      phase: first.shape.phase ?? unit.phase,
      ...getOneDayStudy({
        date: first.date,
        lessonMinutes: unit.minutes,
        share: first.shape.share,
      }),
    })),
  };
}
