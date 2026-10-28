import { type QueueUnit } from "./plan-units";
import {
  type DroppedUnit,
  type PlanDay,
  type ScheduledUnit,
  scheduleUnits,
} from "./schedule-units";

const EPSILON = 1e-6;

export type LaidOutOrder = { dropped: QueueUnit[]; placed: QueueUnit[] };

type ExtrasPlace = "inPlace" | "last";

export function toQueueUnit(
  unit: QueueUnit &
    Partial<
      Pick<
        DroppedUnit & ScheduledUnit,
        "beside" | "date" | "fittedMinutes" | "studyMinutes" | "studyPortions" | "teachingEnd"
      >
    >,
): QueueUnit {
  const {
    afterDay: _afterDay,
    beside: _beside,
    date: _date,
    fittedMinutes: _fitted,
    heldOn: _held,
    studyMinutes: _study,
    studyPortions: _portions,
    teachingEnd: _end,
    ...plain
  } = unit;

  return plain;
}

function sumMinutes(units: readonly QueueUnit[]): number {
  return units.reduce((total, unit) => total + unit.minutes, 0);
}

function resize(unit: QueueUnit, minutes: number): QueueUnit {
  const { opensDay: _opens, ...plain } = unit;

  const lessons =
    unit.lessons === undefined
      ? {}
      : { lessons: Math.max(1, Math.round((unit.lessons * minutes) / unit.minutes)) };

  return { ...plain, ...lessons, minutes };
}

function splitByOrder({ rest, sequence }: { rest: readonly QueueUnit[]; sequence: QueueUnit[] }) {
  const restByKey = Map.groupBy(rest, (unit) => unit.key);
  const taken = new Map<string, number>();

  const parts = sequence.map((unit) => {
    const own = restByKey.get(unit.key);
    const used = taken.get(unit.key) ?? 0;
    const minutes = own ? Math.min(unit.minutes, sumMinutes(own) - used) : 0;

    if (minutes <= EPSILON) {
      return [];
    }

    taken.set(unit.key, used + minutes);

    const [ownBoss] = unit.kind === "boss" ? (own ?? []) : [];
    return [ownBoss ?? resize(unit, minutes)];
  });

  const extras = [...restByKey].flatMap(([key, own]) => {
    const used = taken.get(key);

    if (used === undefined) {
      return own;
    }

    const left = sumMinutes(own) - used;
    const [first] = own;

    return first && left > EPSILON ? [{ ...resize(first, left), depth: true }] : [];
  });

  return { extras, parts };
}

function findSkillPlaces(sequence: readonly QueueUnit[]) {
  const first = new Map<string, number>();
  const last = new Map<string, number>();

  sequence.forEach((unit, index) => {
    if (!unit.skillId) {
      return;
    }

    if (!first.has(unit.skillId)) {
      first.set(unit.skillId, index);
    }

    last.set(unit.skillId, index);
  });

  return { first, last };
}

function followLearnedOrder({
  extras: place,
  order,
  rest,
}: {
  extras: ExtrasPlace;
  order: LaidOutOrder;
  rest: readonly QueueUnit[];
}): QueueUnit[] {
  const sequence = [...order.placed, ...order.dropped];
  const { extras, parts } = splitByOrder({ rest, sequence });

  if (place === "last") {
    return [...parts.flat(), ...extras];
  }

  const places = findSkillPlaces(sequence);
  const kept = new Set(parts.flat().flatMap((unit) => (unit.skillId ? [unit.skillId] : [])));

  const anchorOf = (unit: QueueUnit) =>
    unit.skillId
      ? (kept.has(unit.skillId) ? places.last : places.first).get(unit.skillId)
      : undefined;

  const anchored = Map.groupBy(extras, (unit) => anchorOf(unit) ?? -1);

  return [
    ...parts.flatMap((part, index) => [...part, ...(anchored.get(index) ?? [])]),
    ...(anchored.get(-1) ?? []),
  ];
}

function sumPlaced(units: readonly QueueUnit[]): Map<string, number> {
  return units.reduce(
    (totals, unit) => totals.set(unit.key, (totals.get(unit.key) ?? 0) + unit.minutes),
    new Map<string, number>(),
  );
}

function teaches(units: readonly QueueUnit[], skillId: string): boolean {
  return units.some((unit) => unit.skillId === skillId && !unit.depth);
}

function keepsPlaced({
  cores = false,
  order,
  quickBases,
  rest,
  schedule,
}: {
  cores?: boolean;
  order: LaidOutOrder;
  quickBases: ReadonlySet<string>;
  rest: readonly QueueUnit[];
  schedule: { units: readonly QueueUnit[] };
}): boolean {
  const pick = (units: readonly QueueUnit[]) =>
    cores ? units.filter((unit) => !unit.depth) : units;

  const before = sumPlaced(pick(order.placed));
  const after = sumPlaced(pick(schedule.units));
  const available = sumPlaced(pick(rest));

  const keepsKeys = [...before].every(
    ([key, minutes]) =>
      (after.get(key) ?? 0) >= Math.min(minutes, available.get(key) ?? 0) - EPSILON,
  );

  const keepsQuick = [...quickBases].every(
    (skillId) =>
      !teaches(order.placed, skillId) ||
      !teaches(rest, skillId) ||
      teaches(schedule.units, skillId),
  );

  return keepsKeys && keepsQuick;
}

export function scheduleLearnedOrder({
  days,
  order,
  quickBases,
  rest,
}: {
  days: readonly PlanDay[];
  order: LaidOutOrder;
  quickBases: ReadonlySet<string>;
  rest: readonly QueueUnit[];
}): ReturnType<typeof scheduleUnits> | null {
  const inPlace = scheduleUnits({
    days,
    units: followLearnedOrder({ extras: "inPlace", order, rest }),
  });

  if (keepsPlaced({ order, quickBases, rest, schedule: inPlace })) {
    return inPlace;
  }

  const last = scheduleUnits({ days, units: followLearnedOrder({ extras: "last", order, rest }) });
  return keepsPlaced({ cores: true, order, quickBases, rest, schedule: last }) ? last : null;
}
