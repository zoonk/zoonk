import { type QueueUnit, getBossKey } from "./plan-units";
import { type PlanDay, type ScheduledUnit, scheduleUnits } from "./schedule-units";
import { markKeptLessons } from "./whole-boss";

export function shiftReserved({
  days,
  minutes,
}: {
  days: readonly PlanDay[];
  minutes: ReadonlyMap<number, number>;
}): PlanDay[] {
  return days.map((day) => {
    const shift = minutes.get(day.date.getTime());

    return shift
      ? { ...day, shape: { ...day.shape, reserved: (day.shape.reserved ?? 0) + shift } }
      : day;
  });
}

function placeOn<TUnit extends QueueUnit>({ day, unit }: { day: PlanDay; unit: TUnit }) {
  return {
    ...unit,
    date: day.date,
    phase: day.shape.phase ?? unit.phase,
    studyMinutes: unit.minutes / (day.shape.share || 1),
  };
}

function scheduleCarriedUnits({
  days,
  today,
  units,
}: {
  days: readonly PlanDay[];
  today: ReadonlySet<string>;
  units: readonly QueueUnit[];
}): ReturnType<typeof scheduleUnits> {
  const schedule = scheduleUnits({ days, units });
  const [first] = days;
  const lastDate = schedule.units.at(-1)?.date.getTime();
  const day = days.find((planDay) => planDay.date.getTime() === lastDate) ?? first;

  if (!day || !first) {
    return schedule;
  }

  const placed = schedule.units.map((unit) =>
    today.has(unit.key) && unit.date > first.date ? placeOn({ day: first, unit }) : unit,
  );

  const kept = schedule.dropped.map(({ fittedMinutes: _fitted, ...unit }) =>
    placeOn({ day: today.has(unit.key) ? first : day, unit }),
  );

  const isToday = (unit: { date: Date }) => unit.date.getTime() === first.date.getTime();
  const all = [...placed, ...kept];

  return {
    ...schedule,
    dropped: [],
    units: [...all.filter((unit) => isToday(unit)), ...all.filter((unit) => !isToday(unit))],
  };
}

type ChallengeRoom = { date: Date; minutes: number; phase: number };

function findRoomEnd({
  ends,
  from,
  phase,
}: {
  ends: ReadonlyMap<number, Date>;
  from: Date;
  phase: number;
}): Date | undefined {
  const ahead = [...ends].filter(([kept, end]) => kept >= phase && end >= from);
  return ahead.toSorted(([a], [b]) => a - b)[0]?.[1];
}

function listChallengeRooms({
  ends,
  from,
  units,
}: {
  ends: ReadonlyMap<number, Date>;
  from: Date;
  units: readonly QueueUnit[];
}): ChallengeRoom[] {
  return units
    .flatMap((unit) => {
      const date =
        unit.kind === "boss" ? findRoomEnd({ ends, from, phase: unit.phase }) : undefined;

      return date ? [{ date, minutes: unit.minutes, phase: unit.phase }] : [];
    })
    .toSorted((a, b) => a.date.getTime() - b.date.getTime());
}

function sumRoomMinutes(rooms: readonly ChallengeRoom[]): Map<number, number> {
  return rooms.reduce(
    (byDay, room) =>
      byDay.set(room.date.getTime(), (byDay.get(room.date.getTime()) ?? 0) + room.minutes),
    new Map<number, number>(),
  );
}

export function markAfterCarried({
  schedule,
  units,
}: {
  schedule: { units: readonly ScheduledUnit[] };
  units: readonly QueueUnit[];
}): QueueUnit[] {
  return markKeptLessons({
    kept: schedule.units.map((unit) => ({
      kind: unit.kind,
      phase: unit.phase,
      scheduledFor: unit.teachingEnd ?? unit.date,
    })),
    units,
  });
}

/**
 * A challenge whose lessons reach the day kept for it moves after them anyway (`keepPhaseEnd`), so
 * time kept there would only push those lessons, and the challenge after them, a day later.
 */
function listHeldRooms({
  carried,
  days,
  rest,
  rooms,
  today,
}: {
  carried: readonly QueueUnit[];
  days: readonly PlanDay[];
  rest: readonly QueueUnit[];
  rooms: readonly ChallengeRoom[];
  today: ReadonlySet<string>;
}): ChallengeRoom[] {
  return rooms.reduce<ChallengeRoom[]>((held, room) => {
    const schedule = scheduleCarriedUnits({
      days: shiftReserved({ days, minutes: sumRoomMinutes(held) }),
      today,
      units: carried,
    });

    const [boss] = markAfterCarried({
      schedule,
      units: rest.filter((unit) => unit.key === getBossKey(room.phase)),
    });

    if (!boss?.after || boss.after < room.date) {
      held.push(room);
    }

    return held;
  }, []);
}

export function scheduleCarriedWork({
  carried,
  days,
  letGo,
  phaseEnds,
  rest,
  today,
}: {
  carried: readonly QueueUnit[];
  days: readonly PlanDay[];
  letGo: boolean;
  phaseEnds: ReadonlyMap<number, Date>;
  rest: readonly QueueUnit[];
  today: ReadonlySet<string>;
}) {
  const first = days[0]?.date;

  const all =
    carried.length > 0 && first
      ? listChallengeRooms({ ends: phaseEnds, from: first, units: rest })
      : [];

  const rooms = letGo ? listHeldRooms({ carried, days, rest, rooms: all, today }) : all;

  const room = sumRoomMinutes(rooms);
  const roomed = shiftReserved({ days, minutes: room });

  return { room, roomed, schedule: scheduleCarriedUnits({ days: roomed, today, units: carried }) };
}
