import { daysBetween, toIsoDate } from "./plan-calendar";
import { type MovedEvent } from "./plan-state";
import { isSpareDay } from "./practice-days";
import { type PlanDay, type ScheduledEvent } from "./schedule-units";

const DAYS_PER_WEEK = 7;

/**
 * Two mocks this close, or a mock this close to the exam, leave no day between them to go over the
 * first one's mistakes.
 */
export const MIN_DAYS_APART = 3;

/** The final stretch's review days, in date order: days closed to new lessons. */
function listFinalStretchReviews({
  days,
  events,
}: {
  days: readonly PlanDay[];
  events: readonly ScheduledEvent[];
}): ScheduledEvent[] {
  const closed = new Set(
    days.filter((day) => !day.shape.open && day.shape.minutes > 0).map((day) => day.date.getTime()),
  );

  return events.filter((event) => event.kind === "review" && closed.has(event.date.getTime()));
}

/**
 * Up to `count` review days, each at least `MIN_DAYS_APART` from the exam and from every mock, or
 * as many weeks as the plan's mocks are apart when one is longer than the learner's study day
 * (`weeks`): the final stretch never crowds them in.
 */
function pickMockDays({
  count,
  events,
  reviews,
  targetDate,
  weeks,
}: {
  count: number;
  events: readonly ScheduledEvent[];
  reviews: readonly ScheduledEvent[];
  targetDate: Date;
  weeks: number;
}): string[] {
  const apart = weeks > 1 ? weeks * DAYS_PER_WEEK : MIN_DAYS_APART;
  const mocks = events.filter((event) => event.kind === "mock").map((event) => event.date);

  const picked = reviews.reduce<Date[]>((chosen, review) => {
    const isApart = (date: Date, days: number) => Math.abs(daysBetween(date, review.date)) >= days;

    if (
      chosen.length < count &&
      isApart(targetDate, MIN_DAYS_APART) &&
      mocks.every((date) => isApart(date, apart)) &&
      chosen.every((date) => isApart(date, apart))
    ) {
      chosen.push(review.date);
    }

    return chosen;
  }, []);

  return picked.map((date) => toIsoDate(date));
}

/**
 * An exam plan whose lessons end weeks before its date spends each spare week on one more mock in
 * its final stretch, beside the weekly ones: once everything is learned, full practice tests in the
 * exam's format and conditions are what prepares best (retrieval practice, Roediger & Karpicke
 * 2006; Adesope et al. 2017), with days between them to go over each one's mistakes. A mock longer
 * than the learner's study day takes as many spare weeks as the plan's mocks are apart (`weeks`,
 * see `getMockWeeks`). A spare mock takes a review day's place and runs like the weekly ones
 * (questions from the exam's shared bank, Plus like every mock). A learner who moves one ("Move
 * to Monday") finds it on that day.
 */
export function addSpareMocks({
  days,
  events,
  lastLessonDate,
  mockMinutes,
  moves,
  targetDate,
  weeks,
}: {
  days: readonly PlanDay[];
  events: readonly ScheduledEvent[];
  lastLessonDate: Date | null;
  mockMinutes: number;
  moves: readonly MovedEvent[];
  targetDate: Date;
  /** Weeks from one of the plan's mocks to the next (see `getMockWeeks`). */
  weeks: number;
}): ScheduledEvent[] {
  const spareDays = days.filter((day) => isSpareDay({ day, lastLessonDate })).length;
  const count = Math.floor(spareDays / (DAYS_PER_WEEK * weeks));

  if (count === 0) {
    return [...events];
  }

  const reviews = listFinalStretchReviews({ days, events });
  const picked = pickMockDays({ count, events, reviews, targetDate, weeks });
  const placed = new Set(picked.map((day) => moves.find((move) => move.from === day)?.to ?? day));

  return events.map((event): ScheduledEvent => {
    const day = toIsoDate(event.date);

    return event.kind === "review" && placed.has(day)
      ? {
          ...event,
          key: `mock:${day}`,
          kind: "mock",
          minutes: mockMinutes,
          mock: { fullLength: true },
          replacesDay: true,
        }
      : event;
  });
}
