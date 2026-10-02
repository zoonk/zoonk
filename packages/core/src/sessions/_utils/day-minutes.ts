import { type Goal } from "@zoonk/db";
import { getExamDayRules, getPlannedMinutes } from "../../plans/planner/plan-days";
import { parsePlanSettings } from "../../plans/planner/plan-state";

/**
 * The minutes a goal's plan gives one learner-local date: the weekday's time (rest days are 0),
 * halved in a light week, a short review the day before an exam and nothing from the exam on. The
 * session builds the day from it, so the plan and Today always agree.
 */
export function getGoalDayMinutes({
  date,
  goal,
  planSettings,
}: {
  date: Date;
  goal: Pick<Goal, "dailyMinutes" | "kind" | "targetDate">;
  /** The plan's stored settings, or null for a goal without a plan yet. */
  planSettings: unknown;
}): number {
  const settings = parsePlanSettings(planSettings);

  return getPlannedMinutes({
    calendar: {
      dailyMinutes: goal.dailyMinutes,
      lightWeeks: settings.lightWeeks,
      weekdayMinutes: settings.weekdayMinutes,
    },
    date,
    exam: getExamDayRules({ isExam: goal.kind === "exam", settings }),
    targetDate: goal.targetDate,
  });
}
