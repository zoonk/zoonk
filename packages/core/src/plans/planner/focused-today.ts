import { type QueueUnit } from "./plan-units";
import { type PlanDay, type ScheduledUnit, getLessonCapacity } from "./schedule-units";

/** Floating-point sums of lesson minutes must not leave a lesson out of today. */
const EPSILON = 1e-6;

/** The focused lessons today has taken so far, and whether it still takes more. */
type TodayTaking = { open: boolean; started: Set<string>; taken: QueueUnit[]; used: number };

/** Whether every skill a lesson's skill builds on is begun, or has nothing left to place. */
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

/** Today takes a ready lesson while it fits, and stops at the first that doesn't. */
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

  if (state.used + unit.minutes > capacity + EPSILON) {
    state.open = false;
    return state;
  }

  state.taken.push(unit);
  state.started.add(unit.skillId ?? "");
  state.used += unit.minutes;
  return state;
}

/**
 * A change of focus keeps today as the learner saw it (see `CarryOver.todayExceptAreas`): the time
 * left today, the time the areas it gives less to freed included, goes only to the focused areas'
 * next lessons that fit, after the ones that stayed, and the rest of the plan starts tomorrow.
 * Planned with the rest, "less natural sciences" filled Rafaela's freed time with human sciences,
 * which she never named. A focused lesson waits for what its skill builds on when the learner
 * hasn't begun it (R16), unless it comes today too: a career's content structure for interfaces
 * came today, two days before the information architecture it builds on. Returns the lessons
 * today takes, the days with today's time taken, and what's left.
 */
export function takeFocusedToday({
  begun,
  days,
  prerequisites,
  units,
}: {
  /** The skills the learner began, or whose lessons today keeps (see `listBegunSkillIds`). */
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
      studyMinutes: unit.minutes / (first.shape.share || 1),
    })),
  };
}
