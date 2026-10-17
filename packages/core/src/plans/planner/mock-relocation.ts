import { EPSILON, findDayMock, getSpendable } from "./mock-day";
import { type DayShape, type PlanDay } from "./schedule-units";

/**
 * What funding a mock on day `at` takes (see `fundMocks`): the days of its window since the last
 * mock as funding left them (`shapes`: a left-out mock's day is an ordinary day again), what they
 * must give besides its own day's time and what earlier days already set aside (`past`), and its
 * day's shape. Null when they can't give it.
 */
function fundMockOn({
  at,
  days,
  minutes,
  past,
  shapes,
  windowStart,
}: {
  at: number;
  days: readonly PlanDay[];
  minutes: number;
  past: number;
  shapes: readonly DayShape[];
  windowStart: number;
}) {
  const own = shapes[at];

  if (!own) {
    return null;
  }

  const window = days
    .slice(windowStart, at)
    .map((item, offset) => ({
      date: item.date,
      shape: shapes[windowStart + offset] ?? item.shape,
    }));

  const spendable = window.reduce((total, item) => total + getSpendable(item.shape), 0);
  const needed = Math.max(0, minutes - getSpendable(own) - past);

  return needed > spendable + EPSILON ? null : { at, needed, own, spendable, window };
}

/**
 * The next day a mock its own day can't fund beside a phase's checkpoint can move to: an open study
 * day with nothing else on it (no checkpoint, no eve-of-exam review, no lesson the learner was
 * promised or a challenge tests, see `DayShape.kept`), before the next mock and the plan's end, whose window funds
 * it (`fundOn`). Null when none does: the mock is left out.
 */
function findRelocation<T>({
  days,
  from,
  fundOn,
  shapes,
}: {
  days: readonly PlanDay[];
  from: number;
  fundOn: (at: number) => T | null;
  shapes: readonly DayShape[];
}): T | null {
  for (let at = from + 1; at < days.length; at += 1) {
    const day = days[at];
    const shape = shapes[at];

    if (!day || !shape || findDayMock(day.shape)) {
      return null;
    }

    const free = shape.open && shape.minutes > 0 && shape.events.length === 0 && !shape.kept;
    const funded = free ? fundOn(at) : null;

    if (funded) {
      return funded;
    }
  }

  return null;
}

/**
 * Where a mock on day `index` is funded (see `fundMockOn`): its own day, or, when that can't and it
 * `relocates` (a phase's checkpoint took the time it needed, or its day holds lessons the window's
 * challenge tests, `ownBlocked`), the next day that can (see
 * `findRelocation`). Null when neither can: the mock is left out.
 */
export function findMockFunding({
  index,
  ownBlocked = false,
  relocates,
  ...input
}: {
  days: readonly PlanDay[];
  index: number;
  minutes: number;
  /** Its own day holds lessons the window's challenge tests: it can't replace them. */
  ownBlocked?: boolean;
  past: number;
  relocates: boolean;
  shapes: readonly DayShape[];
  windowStart: number;
}) {
  const fundAt = (at: number) => fundMockOn({ ...input, at });
  const own = ownBlocked ? null : fundAt(index);

  if (own || !relocates) {
    return own;
  }

  return findRelocation({ days: input.days, from: index, fundOn: fundAt, shapes: input.shapes });
}
