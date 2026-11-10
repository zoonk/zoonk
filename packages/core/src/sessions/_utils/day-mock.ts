import { type Goal, type PlanItem } from "@zoonk/db";
import { daysBetween, fromIsoDate, toIsoDate } from "../../plans/planner/plan-calendar";
import { parsePlanSettings } from "../../plans/planner/plan-state";
import { canShareMockDay } from "../../plans/planner/short-exam-plan";
import { getGoalDayMinutes } from "./day-minutes";

export function isMockOnlyDay({
  goal,
  hasMock,
  items,
  planSettings,
  today,
}: {
  goal: Pick<Goal, "dailyMinutes" | "kind" | "targetDate">;
  hasMock: boolean;
  items: readonly Pick<PlanItem, "kind" | "scheduledFor">[];
  planSettings: unknown;
  today: Date;
}): boolean {
  if (
    !hasMock ||
    !items.some((item) => item.kind === "mock" && item.scheduledFor?.getTime() === today.getTime())
  ) {
    return false;
  }

  const settings = parsePlanSettings(planSettings);
  const moved = settings.movedEvents.find((move) => move.to === toIsoDate(today));
  const date = moved ? fromIsoDate(moved.from) : today;

  return !canShareMockDay({
    isOnlyDay:
      settings.startDate === toIsoDate(date) &&
      goal.targetDate !== null &&
      daysBetween(date, goal.targetDate) === 1,
    minutes: getGoalDayMinutes({ date, goal, planSettings }),
    shortMockMinutes: settings.shortMockMinutes,
  });
}
