import { type PlanSettings } from "./plan-state";
import { type DayShape, type FixedEvent } from "./schedule-units";

type MockFunding = PlanSettings["mockFunding"][number];

/** Floating-point sums of minutes must not make a funded mock look unfunded. */
export const EPSILON = 1e-6;

/** A weekly or final mock that takes its whole day (see `mockEvent`). */
export function findDayMock(shape: DayShape): FixedEvent | undefined {
  return shape.events.find((event) => event.kind === "mock" && event.replacesDay);
}

/**
 * The time a day can give a mock: its minutes less the events that keep their own time on it,
 * then less the lesson time it keeps for the lesson the learner was promised by it
 * (`DayShape.kept`), so a day that funds a mock still holds it. A review fills what the day has
 * left, so it gets shorter instead.
 */
export function getSpendable(shape: DayShape): number {
  const fixed = shape.events
    .filter((event) => event.kind !== "review" && !event.beside)
    .reduce((sum, event) => sum + event.minutes, 0);

  return Math.max(0, shape.minutes - fixed - (shape.kept ?? 0));
}

/** Funding changes a day's available minutes and its review by the same proportion. */
export function fundDay({ minutes, shape }: { minutes: number; shape: DayShape }): DayShape {
  const spendable = getSpendable(shape);
  const keep = spendable > 0 ? 1 - minutes / spendable : 1;

  return {
    ...shape,
    events: shape.events.map((event) =>
      event.kind === "review" ? { ...event, minutes: event.minutes * keep } : event,
    ),
    minutes: shape.minutes - minutes,
  };
}

/** What the saved funding sets aside on a day, for every mock it funds. */
export function sumSavedOn(funding: readonly MockFunding[], date: string | undefined): number {
  return funding.reduce(
    (total, entry) =>
      total +
      entry.contributions.reduce(
        (sum, contribution) => sum + (contribution.date === date ? contribution.minutes : 0),
        0,
      ),
    0,
  );
}

/** A fully funded mock plays its exact whole clock. */
export function getMockDayMinutes({ base, entry }: { base: number; entry: MockFunding }): number {
  const given = entry.contributions.reduce((sum, contribution) => sum + contribution.minutes, 0);
  const needed = Math.max(0, entry.minutes - base);

  return given >= needed - EPSILON ? Math.max(base, entry.minutes) : base + Math.min(given, needed);
}
