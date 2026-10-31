import { PLAN_EPSILON } from "./plan-precision";
import { type PlanSettings } from "./plan-state";
import { type DayShape, type FixedEvent } from "./schedule-units";

type MockFunding = PlanSettings["mockFunding"][number];

export function findDayMock(shape: DayShape): FixedEvent | undefined {
  return shape.events.find((event) => event.kind === "mock" && event.replacesDay);
}

export function getSpendable(shape: DayShape): number {
  const fixed = shape.events
    .filter((event) => event.kind !== "review" && !event.beside)
    .reduce((sum, event) => sum + event.minutes, 0);

  return Math.max(0, shape.minutes - fixed - (shape.kept ?? 0));
}

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

export function getMockDayMinutes({ base, entry }: { base: number; entry: MockFunding }): number {
  const given = entry.contributions.reduce((sum, contribution) => sum + contribution.minutes, 0);
  const needed = Math.max(0, entry.minutes - base);

  return given >= needed - PLAN_EPSILON
    ? Math.max(base, entry.minutes)
    : base + Math.min(given, needed);
}
