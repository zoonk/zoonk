import { type Goal } from "@zoonk/db";
import { daysBetween, toIsoDate } from "../../plans/planner/plan-calendar";
import { parsePlanSettings } from "../../plans/planner/plan-state";
import { canShareMockDay } from "../../plans/planner/short-exam-plan";
import { getGoalDayMinutes } from "./day-minutes";

/** A mock fills its day, scheduled or carried from a missed one: the learner adds more only by asking. */
export function isMockOnlyDay({
  goal,
  hasMock,
  planSettings,
  today,
}: {
  goal: Pick<Goal, "dailyMinutes" | "kind" | "targetDate">;
  hasMock: boolean;
  planSettings: unknown;
  today: Date;
}): boolean {
  if (!hasMock) {
    return false;
  }

  const settings = parsePlanSettings(planSettings);

  return !canShareMockDay({
    isOnlyDay:
      settings.startDate === toIsoDate(today) &&
      goal.targetDate !== null &&
      daysBetween(today, goal.targetDate) === 1,
    minutes: getGoalDayMinutes({ date: today, goal, planSettings }),
    shortMockMinutes: settings.shortMockMinutes,
  });
}
