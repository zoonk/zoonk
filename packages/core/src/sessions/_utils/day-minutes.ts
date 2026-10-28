import { type Goal } from "@zoonk/db";
import { getPlanCalendar } from "../../plans/planner/plan-calendar";
import { getExamDayRules, getPlannedMinutes } from "../../plans/planner/plan-days";
import { parsePlanSettings } from "../../plans/planner/plan-state";

/** Uses learner-local date labels; returns no teaching from the exam day onward, except whole checkpoints finishing later. */
export function getGoalDayMinutes({
  date,
  goal,
  planSettings,
}: {
  date: Date;
  goal: Pick<Goal, "dailyMinutes" | "kind" | "targetDate">;
  planSettings: unknown;
}): number {
  const settings = parsePlanSettings(planSettings);

  return getPlannedMinutes({
    calendar: getPlanCalendar({ dailyMinutes: goal.dailyMinutes, settings }),
    date,
    exam: getExamDayRules({ isExam: goal.kind === "exam", settings }),
    overflow: settings.checkpointOverflow,
    targetDate: goal.targetDate,
  });
}
