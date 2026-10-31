import { type MockScheduleView } from "../plan-view-contract";
import { daysBetween, toIsoDate } from "../planner/plan-calendar";
import { type ExistingPlanItem } from "../planner/plan-items";

const DAYS_PER_WEEK = 7;

function listMockDaysAhead({
  items,
  today,
}: {
  items: readonly Pick<ExistingPlanItem, "kind" | "scheduledFor" | "status">[];
  today: Date;
}): Date[] {
  const days = items.flatMap((item) =>
    item.kind === "mock" &&
    item.status === "todo" &&
    item.scheduledFor &&
    item.scheduledFor >= today
      ? [item.scheduledFor.getTime()]
      : [],
  );

  return [...new Set(days)].toSorted((a, b) => a - b).map((time) => new Date(time));
}

function getSharedWeekday(days: readonly Date[]): number | null {
  const weekdays = new Set(days.map((day) => day.getUTCDay()));
  const [weekday] = weekdays;
  return days.length > 1 && weekdays.size === 1 && weekday !== undefined ? weekday : null;
}

function getSharedWeeks(days: readonly Date[]): number | null {
  const gaps = new Set(days.slice(1).map((day, index) => daysBetween(days[index] ?? day, day)));
  const [gap] = gaps;

  return gaps.size === 1 && gap !== undefined && gap % DAYS_PER_WEEK === 0
    ? gap / DAYS_PER_WEEK
    : null;
}

export function getMockSchedule({
  items,
  today,
}: {
  items: readonly Pick<ExistingPlanItem, "kind" | "scheduledFor" | "status">[];
  today: Date;
}): MockScheduleView | null {
  const days = listMockDaysAhead({ items, today });
  const [next] = days;

  if (!next) {
    return null;
  }

  return {
    count: days.length,
    everyWeeks: getSharedWeeks(days),
    nextDate: toIsoDate(next),
    weekday: getSharedWeekday(days),
  };
}
