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

/** Up to `count` review days, each at least `MIN_DAYS_APART` from every mock and from the exam. */
function pickMockDays({
  count,
  events,
  reviews,
  targetDate,
}: {
  count: number;
  events: readonly ScheduledEvent[];
  reviews: readonly ScheduledEvent[];
  targetDate: Date;
}): string[] {
  const mocks = [
    targetDate,
    ...events.filter((event) => event.kind === "mock").map((event) => event.date),
  ];

  const picked = reviews.reduce<Date[]>((chosen, review) => {
    const isApart = (date: Date) => Math.abs(daysBetween(date, review.date)) >= MIN_DAYS_APART;

    if (
      chosen.length < count &&
      mocks.every((date) => isApart(date)) &&
      chosen.every((date) => isApart(date))
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
 * 2006; Adesope et al. 2017), with days between them to go over each one's mistakes. A spare mock
 * takes a review day's place and runs like the weekly ones (questions from the exam's shared bank,
 * Plus like every mock). A learner who moves one ("Move to Monday") finds it on that day.
 */
export function addSpareMocks({
  days,
  events,
  lastLessonDate,
  mockMinutes,
  moves,
  targetDate,
}: {
  days: readonly PlanDay[];
  events: readonly ScheduledEvent[];
  lastLessonDate: Date | null;
  mockMinutes: number;
  moves: readonly MovedEvent[];
  targetDate: Date;
}): ScheduledEvent[] {
  const spareDays = days.filter((day) => isSpareDay({ day, lastLessonDate })).length;
  const count = Math.floor(spareDays / DAYS_PER_WEEK);

  if (count === 0) {
    return [...events];
  }

  const reviews = listFinalStretchReviews({ days, events });
  const picked = pickMockDays({ count, events, reviews, targetDate });
  const placed = new Set(picked.map((day) => moves.find((move) => move.from === day)?.to ?? day));

  return events.map((event): ScheduledEvent => {
    const day = toIsoDate(event.date);

    return event.kind === "review" && placed.has(day)
      ? { ...event, key: `mock:${day}`, kind: "mock", minutes: mockMinutes, replacesDay: true }
      : event;
  });
}
