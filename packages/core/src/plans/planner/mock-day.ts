import { type DayShape, type FixedEvent } from "./schedule-units";

/** Floating-point sums of minutes must not make a funded mock look unfunded. */
export const EPSILON = 1e-6;

/** A weekly or final mock that takes its whole day (see `mockEvent`). */
export function findDayMock(shape: DayShape): FixedEvent | undefined {
  return shape.events.find((event) => event.kind === "mock" && event.replacesDay);
}

/**
 * The time a day can give a mock: its minutes less the events that keep their own time on it (a
 * phase's checkpoint), then less the lesson time it keeps for the lesson the learner was promised
 * by it, or the teaching its window's challenge tests (`DayShape.kept`), so a day that funds a mock still holds them. A review fills what the
 * day has left, so it gets shorter instead.
 */
export function getSpendable(shape: DayShape): number {
  const fixed = shape.events
    .filter((event) => event.kind !== "review" && !event.beside)
    .reduce((sum, event) => sum + event.minutes, 0);

  return Math.max(0, shape.minutes - fixed - (shape.kept ?? 0));
}
