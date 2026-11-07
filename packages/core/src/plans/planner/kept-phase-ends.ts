import { findDayIndex, isLessonRoom } from "./day-index";
import { canHoldPhaseChallenge } from "./phase-challenge-days";
import { listWonPhases } from "./phase-time";
import { fromIsoDate, toIsoDate } from "./plan-calendar";
import { LEARN_KINDS } from "./plan-item-rules";
import { type ExistingPlanItem } from "./plan-items";
import { PLAN_EPSILON } from "./plan-precision";
import { type PlanPhase } from "./plan-state";
import { type QueueUnit, getBossKey } from "./plan-units";
import {
  type PlanDay,
  type ScheduledUnit,
  getCumulativeCapacity,
  getLessonCapacity,
  getUsedAfterUnits,
  placeUnits,
} from "./schedule-units";
import { withKeptLessons } from "./whole-boss";

export function getShownPhaseEnds({
  items,
  moved = new Map(),
  phases,
  released = new Set(),
}: {
  items: readonly Pick<ExistingPlanItem, "kind" | "phase" | "scheduledFor" | "status">[];
  moved?: ReadonlyMap<number, string>;
  phases: readonly PlanPhase[];
  released?: ReadonlySet<number>;
}): Map<number, Date> {
  if (phases.some((phase) => phase.kind !== "learn")) {
    return new Map();
  }

  const challengeDays = new Set(
    items.flatMap((item) =>
      item.kind === "boss" && item.status === "todo" && item.scheduledFor
        ? [`${item.phase}:${toIsoDate(item.scheduledFor)}`]
        : [],
    ),
  );

  const won = listWonPhases(items);

  const shown = phases
    .slice(0, -1)
    .flatMap((phase, index) =>
      phase.endDate && (won.has(index) || challengeDays.has(`${index}:${phase.endDate}`))
        ? [[index, phase.endDate] as const]
        : [],
    );

  return new Map(
    [...new Map([...shown, ...moved])].flatMap(([index, date]) =>
      released.has(index) ? [] : [[index, fromIsoDate(date)]],
    ),
  );
}

function findEndDay({ date, days }: { date: Date; days: readonly PlanDay[] }): number | null {
  const index = days.findIndex((day) => day.date.getTime() === date.getTime());
  return index === -1 ? null : index;
}

function getDayEndAfter({
  cumulative,
  units,
}: {
  cumulative: readonly number[];
  units: readonly QueueUnit[];
}): number {
  const used = getUsedAfterUnits({ cumulative, units });
  const day = used <= PLAN_EPSILON ? -1 : findDayIndex({ cumulative, needed: used });

  return day === -1 ? used : Math.max(used, cumulative[day] ?? used);
}

function pullPhaseDepth({
  phase,
  later,
  room,
}: {
  later: readonly QueueUnit[];
  phase: number;
  room: number;
}): QueueUnit[] {
  const candidates = later.filter((unit) => unit.kind === "lesson" && unit.phase <= phase);

  const ends = candidates.reduce<number[]>((sums, unit) => {
    sums.push((sums.at(-1) ?? 0) + unit.minutes);
    return sums;
  }, []);

  const count = ends.findIndex((end) => end > room + PLAN_EPSILON);
  return count === -1 ? candidates : candidates.slice(0, count);
}

function keepPhaseEnd({
  boss,
  cumulative,
  endDay,
  units,
}: {
  boss: QueueUnit;
  cumulative: readonly number[];
  endDay: number;
  units: readonly QueueUnit[];
}): QueueUnit[] {
  const index = units.findIndex((unit) => unit.key === boss.key);
  const before = units.slice(0, index);
  const after = units.slice(index + 1);

  const start = cumulative[endDay - 1] ?? 0;

  const late = placeUnits({ cumulative, units: before }).findIndex(
    ({ dayIndex, start: unitStart, unit }) =>
      dayIndex < 0 || unitStart + unit.minutes > start + PLAN_EPSILON,
  );

  const lateLesson =
    (late !== -1 && before.slice(late).some((unit) => LEARN_KINDS.has(unit.kind))) ||
    (boss.afterDay ?? -1) >= endDay;

  if (lateLesson) {
    return [...units];
  }

  const held = { ...boss, heldOn: endDay, startsAt: start };

  // Only challenges run past the shown day here. Earlier phases' stay before this one, which
  // gives way to them when they reach its day (`placeBoss`).
  if (late !== -1) {
    const passing = before.slice(late);

    const earlier = passing
      .filter((unit) => unit.phase < boss.phase)
      .toSorted((first, second) => first.phase - second.phase);

    const others = passing.filter((unit) => unit.phase >= boss.phase);

    return [...before.slice(0, late), ...earlier, held, ...others, ...after];
  }

  const pulled = pullPhaseDepth({
    later: after,
    phase: boss.phase,
    room: start - getDayEndAfter({ cumulative, units: before }),
  });

  const pulledKeys = new Set(pulled.map((unit) => unit.key));

  return [...before, ...pulled, held, ...after.filter((unit) => !pulledKeys.has(unit.key))];
}

export function keepPhaseEnds({
  days,
  ends,
  units: given,
}: {
  days: readonly PlanDay[];
  ends: ReadonlyMap<number, Date>;
  units: readonly QueueUnit[];
}): QueueUnit[] {
  if (ends.size === 0) {
    return [...given];
  }

  const cumulative = getCumulativeCapacity(days);
  const units = withKeptLessons({ days, units: given });

  const pinned = units.flatMap((unit) => {
    const date = unit.kind === "boss" ? ends.get(unit.phase) : undefined;
    const endDay = date ? findEndDay({ date, days }) : null;

    return endDay === null ? [] : [{ boss: unit, endDay }];
  });

  return pinned.reduce<QueueUnit[]>(
    (queue, { boss, endDay }) => keepPhaseEnd({ boss, cumulative, endDay, units: queue }),
    [...units],
  );
}

export type StrainedEnd = { phase: number; resting: boolean; room: string | null };

function findRoomDay({
  date,
  days,
  phase,
  units,
}: {
  date: Date;
  days: readonly PlanDay[];
  phase: number;
  units: readonly ScheduledUnit[];
}): string | null {
  const challengeDays = new Set(
    units.flatMap((unit) =>
      unit.kind === "boss" && unit.phase !== phase ? [unit.date.getTime()] : [],
    ),
  );

  const room = days.find(
    (day) =>
      day.date > date &&
      canHoldPhaseChallenge({ day, rules: { kind: "lessons" } }) &&
      !challengeDays.has(day.date.getTime()),
  );

  return room ? toIsoDate(room.date) : null;
}

export function listStrainedEnds({
  days,
  ends,
  units,
}: {
  days: readonly PlanDay[];
  ends: ReadonlyMap<number, Date>;
  units: readonly ScheduledUnit[];
}): StrainedEnd[] {
  return [...ends].flatMap(([phase, date]) => {
    const day = days.find((entry) => entry.date.getTime() === date.getTime());
    const onDay = units.filter((unit) => unit.date.getTime() === date.getTime());
    const boss = onDay.find((unit) => unit.key === getBossKey(phase));

    if (!day || !boss) {
      return [];
    }

    const capacity = getLessonCapacity(day);

    const load = onDay.reduce(
      (total, unit) => total + (unit.kind === "boss" ? unit.minutes : 0),
      0,
    );

    return !isLessonRoom(capacity) || load > Math.max(capacity, boss.minutes) + PLAN_EPSILON
      ? [
          {
            phase,
            resting: day.shape.minutes <= 0,
            room: findRoomDay({ date, days, phase, units }),
          },
        ]
      : [];
  });
}
