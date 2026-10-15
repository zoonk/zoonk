import { type SelectedSummary } from "../_utils/selected-summary-contract";
import { type BuildPlanInput, type BuiltPlan } from "./build-plan";
import { withDailyMinutes } from "./daily-time-plans";
import { findDayMock, getSpendable } from "./mock-day";
import { toIsoDate } from "./plan-calendar";
import { createDays, getPlanStart } from "./plan-run-days";
import { type DayShape, type PlanDay, getLessonCapacity } from "./schedule-units";

/** Floating-point sums of minutes must not read a capacity that holds the work as short. */
const EPSILON = 1e-6;

/** The most a day has: the about-N search never asks for more (see `estimateDailyNeed`). */
const DAY_MINUTES = 1440;

type DailyNeed = SelectedSummary["dailyNeed"];

/** A mock among the fixed days (see `FixedDays`): its day, length, and what past days set aside for it. */
type FixedMock = { at: number; clock: number; past: number };

/**
 * The days before the deadline as one build fixed them: each day's events, share and whether new
 * lessons may go on it, its minutes at any daily time (`minutesAt`, in the days' order), and its
 * mocks.
 */
export type FixedDays = {
  days: readonly Pick<PlanDay, "shape">[];
  minutesAt: (dailyMinutes: number) => readonly number[];
  mocks: readonly FixedMock[];
};

/**
 * The lesson minutes the fixed days give at `dailyMinutes` a day (see `getLessonCapacity`: a
 * leading checkpoint takes its day's time, one beside its lessons none, a mock's day gives none),
 * less what each mock still needs from the days before it since the mock before (its length, less
 * what past days set aside and what its own day can give, see `getSpendable`), at the lowest share
 * of those days: an optimistic bound, never a plan.
 */
function getCapacityAt({ dailyMinutes, fixed }: { dailyMinutes: number; fixed: FixedDays }): {
  lessons: number;
  value: number;
} {
  const minutes = fixed.minutesAt(dailyMinutes);

  const shapes = fixed.days.map((day, at) => ({
    date: new Date(0),
    shape: { ...day.shape, minutes: minutes[at] ?? 0 },
  }));

  const lessons = shapes.reduce((sum, day) => sum + getLessonCapacity(day), 0);

  const needs = fixed.mocks.reduce((sum, mock, index) => {
    const own = shapes[mock.at]?.shape;
    const ownDay = own && { ...own, events: own.events.filter((event) => !event.replacesDay) };
    const given = ownDay ? Math.min(mock.clock, getSpendable(ownDay)) : 0;
    const need = Math.max(0, mock.clock - mock.past - given);
    const windowStart = (fixed.mocks[index - 1]?.at ?? -1) + 1;

    const shares = shapes
      .slice(windowStart, mock.at)
      .filter((day) => day.shape.open)
      .map((day) => day.shape.share);

    return sum + (shares.length > 0 ? Math.min(...shares) * need : 0);
  }, 0);

  return { lessons, value: lessons - needs };
}

/**
 * About how many minutes a day `remaining` raw lesson minutes need on the fixed days: the fewest
 * whose capacity (see `getCapacityAt`) holds them. Capacity never falls as the daily time grows, so
 * the least such time is found by halving. An estimate: another daily time can place its events and
 * mocks otherwise, so it never says the plan fits there.
 */
export function estimateDailyNeed({
  fixed,
  remaining,
}: {
  fixed: FixedDays;
  remaining: number;
}): DailyNeed {
  if (remaining <= EPSILON) {
    return { basis: "estimated", minutes: null, reason: "nothingLeft" };
  }

  const capacityAt = (dailyMinutes: number) => getCapacityAt({ dailyMinutes, fixed });
  const most = capacityAt(DAY_MINUTES);

  if (most.lessons <= EPSILON) {
    return { basis: "estimated", minutes: null, reason: "noStudyDays" };
  }

  if (most.value < remaining - EPSILON) {
    return { basis: "estimated", minutes: null, reason: "exceedsDay" };
  }

  const search = (low: number, high: number): number => {
    if (low >= high) {
      return low;
    }

    const middle = Math.floor((low + high) / 2);

    return capacityAt(middle).value >= remaining - EPSILON
      ? search(low, middle)
      : search(middle + 1, high);
  };

  return { basis: "estimated", minutes: search(1, DAY_MINUTES) };
}

/**
 * The fixed events a day keeps whatever the daily time: its checkpoints and mocks as this build
 * placed them, a mock the plan holds there included and one it doesn't hold left out. Reviews fill
 * what a day has left, so they take none of its lesson time.
 */
function toFixedShape({
  day,
  mockDays,
}: {
  day: PlanDay;
  mockDays: ReadonlyMap<string, number>;
}): DayShape {
  const date = toIsoDate(day.date);
  const held = mockDays.get(date);
  const mock = findDayMock(day.shape);

  const events = day.shape.events.filter(
    (event) => event.kind !== "review" && (event !== mock || held !== undefined),
  );

  const withMock =
    held !== undefined && !mock
      ? [
          ...events,
          {
            key: `mock:${date}`,
            kind: "mock" as const,
            minutes: held,
            replacesDay: true,
            title: "",
          },
        ]
      : events;

  return {
    events: withMock,
    minutes: day.shape.minutes,
    open: day.shape.open,
    phase: day.shape.phase,
    share: day.shape.share,
  };
}

/**
 * The days before the deadline as this build fixed them (see `FixedDays`): from today, each with
 * its checkpoints and mocks where the build placed them (see `toFixedShape`), its minutes at
 * another daily time read from the plan's own calendar, and what past days set aside for each mock.
 */
export function readFixedDays({
  built,
  deadline,
  input,
}: {
  built: BuiltPlan;
  deadline: string;
  input: BuildPlanInput;
}): FixedDays {
  const today = toIsoDate(input.today);

  const mockDays = new Map(
    built.items.flatMap((item) =>
      item.kind === "mock" && item.status === "todo" && item.scheduledFor
        ? [[toIsoDate(item.scheduledFor), item.minutes] as const]
        : [],
    ),
  );

  const days = built.planDays
    .filter((day) => {
      const date = toIsoDate(day.date);
      return date >= today && date < deadline;
    })
    .map((day) => ({ date: day.date, shape: toFixedShape({ day, mockDays }) }));

  const mocks = days.flatMap((day, at) => {
    const mock = findDayMock(day.shape);

    if (!mock) {
      return [];
    }

    const date = toIsoDate(day.date);
    const entry = built.mockFunding.find((funding) => funding.date === date);

    const past = (entry?.contributions ?? [])
      .filter((contribution) => contribution.date < today)
      .reduce((sum, contribution) => sum + contribution.minutes, 0);

    return [{ at, clock: entry?.minutes ?? mock.minutes, past }];
  });

  const minutesAt = (dailyMinutes: number) => {
    const at = withDailyMinutes(input, dailyMinutes);
    const { describeDay } = createDays({ input: at, planStart: getPlanStart(at) });
    return days.map((day) => describeDay(day.date).minutes);
  };

  return { days, minutesAt, mocks };
}
