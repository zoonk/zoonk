import { type QueueUnit } from "./plan-units";
import {
  type DroppedUnit,
  type PlanDay,
  type ScheduledUnit,
  scheduleUnits,
} from "./schedule-units";

/** Floating-point sums of a stand-in's parts must not leave a sliver of one behind. */
const EPSILON = 1e-6;

/** The units after this week as a plan laid them out: what it placed, then what didn't fit. */
export type LaidOutOrder = { dropped: QueueUnit[]; placed: QueueUnit[] };

/**
 * Where the units a base's choice adds go: next to that base's place in the order, or after
 * everything, so they only take time nothing else uses.
 */
type ExtrasPlace = "inPlace" | "last";

/** A laid-out unit as the queue unit it was, without its day or what of it fit. */
export function toQueueUnit(
  unit: QueueUnit &
    Partial<Pick<DroppedUnit & ScheduledUnit, "date" | "fittedMinutes" | "studyMinutes">>,
): QueueUnit {
  // The day a kept end held a challenge on is a place in that run's days, not in another's.
  const {
    date: _date,
    fittedMinutes: _fitted,
    heldOn: _held,
    studyMinutes: _study,
    ...plain
  } = unit;

  return plain;
}

function sumMinutes(units: readonly QueueUnit[]): number {
  return units.reduce((total, unit) => total + unit.minutes, 0);
}

/**
 * A unit with `minutes` of what it was: a stand-in's part plans as many of its lessons as its
 * minutes hold, and its day no longer opens fresh, so what a base no longer takes of a day goes
 * to what comes next.
 */
function resize(unit: QueueUnit, minutes: number): QueueUnit {
  const { opensDay: _opens, ...plain } = unit;

  const lessons =
    unit.lessons === undefined
      ? {}
      : { lessons: Math.max(1, Math.round((unit.lessons * minutes) / unit.minutes)) };

  return { ...plain, ...lessons, minutes };
}

/**
 * What the order holds of `rest`: each of its units with no more than `rest` gives its key, and
 * what `rest` has beyond the order (a base's quick lesson, the depth of one studied in depth).
 */
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
    return [resize(unit, minutes)];
  });

  const extras = [...restByKey].flatMap(([key, own]) => {
    const used = taken.get(key);

    if (used === undefined) {
      return own;
    }

    // What a key has beyond the order is past what the base's core held: its depth.
    const left = sumMinutes(own) - used;
    const [first] = own;

    return first && left > EPSILON ? [{ ...resize(first, left), depth: true }] : [];
  });

  return { extras, parts };
}

/** Where each skill sits in the order: its first and its last unit. */
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

/**
 * The plan's units after this week in the order the plan with every base's core laid them out, so
 * a base studied another way only moves time: each unit keeps its place, a base's quick lesson
 * takes the place of its core, one skipped and the lessons it no longer has leave, and everything
 * else comes when it came or earlier, with no day kept for a subject, so the time freed goes to
 * what came next. What a choice adds (a quick lesson, a base's depth) goes next to that base's
 * place (`inPlace`: after its last unit, or where its first one was when none of it stays), or
 * after everything (`last`). Without it, a cheaper base reordered the cut and moved time between
 * subjects: ecology left an ENEM plan for the topics its cheaper bases now reached, and a
 * languages topic for days the essay took.
 */
function followLearnedOrder({
  extras: place,
  order,
  rest,
}: {
  extras: ExtrasPlace;
  order: LaidOutOrder;
  /** This plan's own units after this week, with each base studied as chosen. */
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

/** The minutes of each key a schedule placed. */
function sumPlaced(units: readonly QueueUnit[]): Map<string, number> {
  return units.reduce(
    (totals, unit) => totals.set(unit.key, (totals.get(unit.key) ?? 0) + unit.minutes),
    new Map<string, number>(),
  );
}

/** Whether these units teach the skill beyond its depth. */
function teaches(units: readonly QueueUnit[], skillId: string): boolean {
  return units.some((unit) => unit.skillId === skillId && !unit.depth);
}

/**
 * Whether a schedule placed, of each key the order placed, as much as `rest` still has of it:
 * of every unit, or of the cores only (`cores`), the depth left to time. And whether each base
 * studied with a quick lesson (`quickBases`) whose core the order placed keeps that lesson: it
 * takes the core's place under a key the order never placed, so a Câmara plan let the quick
 * lesson of legislative procedures go after everything and out, while provisional measures, asked
 * less, kept 7 lessons.
 */
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

/**
 * Schedules a plan with base choices in the order the plan with every base's core laid out (see
 * `followLearnedOrder`): what a choice adds goes next to its base, unless that leaves out anything
 * the order placed; then it goes after everything, where it only takes time nothing else uses. So
 * no choice ever pushes out what the base's core kept. Null when even then a core the order placed
 * doesn't fit, or a base's quick lesson in its place (see `keepsPlaced`): the run has less time
 * than that plan had (a session's end leaves this week as it was shown, and that plan was laid out
 * from today), so the plan cuts by its own ranking, not the order's last lessons. Following the
 * order, a Câmara plan cut a topic asked often and kept the one asked least.
 */
export function scheduleLearnedOrder({
  days,
  order,
  quickBases,
  rest,
}: {
  days: readonly PlanDay[];
  order: LaidOutOrder;
  /** The bases the learner chose to study with a quick lesson (see `listQuickBaseIds`). */
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
