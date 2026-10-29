import { type DailyNeed, type SelectedSummary } from "../_utils/selected-summary-contract";
import { type BuildPlanInput, type BuiltPlan } from "./build-plan";
import { withDailyMinutes } from "./daily-time-plans";
import { findDayMock, getSpendable } from "./mock-day";
import { addDays, getStudyMinutes, toIsoDate } from "./plan-calendar";
import { PLAN_EPSILON } from "./plan-precision";
import { createDays, getCalendar, getPlanStart } from "./plan-run-days";
import { type DayShape, type PlanDay, getLessonCapacity } from "./schedule-units";

const DAY_MINUTES = 1440;

const FINISH_HORIZON_DAYS = 1100;

type Finish = SelectedSummary["forecast"]["finish"];

type FixedMock = { at: number; clock: number; past: number };

export type FixedDays = {
  days: readonly Pick<PlanDay, "shape">[];
  minutesAt: (dailyMinutes: number) => readonly number[];
  mocks: readonly FixedMock[];
};

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
 * Capacity never falls as the daily time grows, so halving finds the fewest minutes that hold the
 * work.
 */
export function estimateDailyNeed({
  fixed,
  remaining,
}: {
  fixed: FixedDays;
  remaining: number;
}): DailyNeed {
  if (remaining <= PLAN_EPSILON) {
    return { basis: "estimated", minutes: null, reason: "nothingLeft" };
  }

  const capacityAt = (dailyMinutes: number) => getCapacityAt({ dailyMinutes, fixed });
  const most = capacityAt(DAY_MINUTES);

  if (most.lessons <= PLAN_EPSILON) {
    return { basis: "estimated", minutes: null, reason: "noStudyDays" };
  }

  if (most.value < remaining - PLAN_EPSILON) {
    return { basis: "estimated", minutes: null, reason: "exceedsDay" };
  }

  const search = (low: number, high: number): number => {
    if (low >= high) {
      return low;
    }

    const middle = Math.floor((low + high) / 2);

    return capacityAt(middle).value >= remaining - PLAN_EPSILON
      ? search(low, middle)
      : search(middle + 1, high);
  };

  return { basis: "estimated", minutes: search(1, DAY_MINUTES) };
}

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

export function estimateFinish({
  built,
  input,
  remaining,
}: {
  built: BuiltPlan;
  input: BuildPlanInput;
  remaining: number;
}): Finish {
  if (remaining <= PLAN_EPSILON) {
    return { date: null, reason: "nothingLeft" };
  }

  const today = toIsoDate(input.today);
  const calendar = getCalendar(input);
  const ahead = built.planDays.filter((day) => toIsoDate(day.date) >= today);
  const laidOut = new Map(ahead.map((day) => [toIsoDate(day.date), day]));
  const share = ahead.findLast((day) => day.shape.open)?.shape.share ?? 1;

  const capacityOn = (date: Date) => {
    const day = laidOut.get(toIsoDate(date));

    return day?.shape.open ? getLessonCapacity(day) : getStudyMinutes({ calendar, date }) * share;
  };

  const days = Array.from({ length: FINISH_HORIZON_DAYS }, (_, offset) =>
    addDays(input.today, offset),
  );

  const capacities = days.map((date) => capacityOn(date));

  const sums = capacities.reduce<number[]>((totals, capacity) => {
    totals.push((totals.at(-1) ?? 0) + capacity);
    return totals;
  }, []);

  const at = sums.findIndex((sum) => sum >= remaining - PLAN_EPSILON);
  const date = days[at];

  if (date) {
    return { date: toIsoDate(date) };
  }

  return {
    date: null,
    reason: (sums.at(-1) ?? 0) <= PLAN_EPSILON ? "noStudyDays" : "beyondHorizon",
  };
}
