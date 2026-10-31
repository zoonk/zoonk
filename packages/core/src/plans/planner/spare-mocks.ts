import { daysBetween, toIsoDate } from "./plan-calendar";
import { type MovedEvent } from "./plan-state";
import { isSpareDay } from "./practice-days";
import { type PlanDay, type ScheduledEvent } from "./schedule-units";

const DAYS_PER_WEEK = 7;

export const MIN_DAYS_APART = 3;

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
 * Full practice tests prepare best once everything is learned (Roediger & Karpicke 2006; Adesope et
 * al. 2017).
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
