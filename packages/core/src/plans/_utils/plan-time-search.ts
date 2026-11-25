import "server-only";
import { MIN_DAILY_MINUTES, getCandidateDailyMinutesLimit } from "../daily-minutes";
import { applyPlanOperations } from "../planner/plan-operations";
import { type PlanState } from "../planner/plan-state";
import { getScheduleOperations } from "../planner/schedule-operations";
import { type PlanTimeAdviceInput, type PlanTimeToCoverInput } from "../time-advice-contract";
import { type PlanContext } from "./plan-context";
import { computePlan } from "./replan";
import { getChangePlanning } from "./steered-areas";

/** A change is planned by its kind alone, so any time stands for the one asked about. */
export const TIME_CHANGE = getChangePlanning([
  { kind: "setDailyMinutes", minutes: MIN_DAILY_MINUTES },
]);

export function withStudyWeek({
  aim,
  context,
  dailyMinutes,
  fullCourse = false,
  input,
}: Pick<PlanTimeAdviceInput, "aim" | "fullCourse"> & {
  context: PlanContext;
  dailyMinutes: number;
  input: PlanTimeToCoverInput;
}): PlanState {
  const schedule = getScheduleOperations({
    input: { ...input, dailyMinutes },
    state: context.state,
  });

  const result = applyPlanOperations({
    goalKind: context.goal.kind,
    maxDailyMinutes: getCandidateDailyMinutesLimit(dailyMinutes),
    operations: [
      ...schedule,
      ...(fullCourse ? [{ fullCourse, kind: "setFullCourse" } as const] : []),
      ...(aim && context.goal.kind === "language" ? [{ aim, kind: "setAim" } as const] : []),
    ],
    state: context.state,
    today: context.today,
  });

  if ("error" in result) {
    throw new Error(`Cannot evaluate the study schedule: ${result.error}`);
  }

  return result.state;
}

/**
 * Plans each daily time as setting it would, today laid out again included, so the time the question
 * and the Plan suggest is the time that covers the goal once applied.
 */
export function searchPlanTime({
  context,
  week = {},
}: {
  context: PlanContext;
  week?: PlanTimeToCoverInput;
}) {
  const stateAt = (dailyMinutes: number) => withStudyWeek({ context, dailyMinutes, input: week });

  const searchStart =
    week.studyDays === undefined && week.weekendMinutes === undefined
      ? context.state.goal.dailyMinutes
      : MIN_DAILY_MINUTES;

  return computePlan({
    ...TIME_CHANGE,
    context,
    state: stateAt(searchStart),
    studyScheduleAt: (dailyMinutes) => {
      const state = stateAt(dailyMinutes);

      return {
        dailyMinutes: state.goal.dailyMinutes,
        weekdayMinutes: state.settings.weekdayMinutes,
      };
    },
  });
}
