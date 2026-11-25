import "server-only";
import { MIN_DAILY_MINUTES, getCandidateDailyMinutesLimit } from "../daily-minutes";
import { applyPlanOperations } from "../planner/plan-operations";
import { type PlanState } from "../planner/plan-state";
import { getScheduleOperations } from "../planner/schedule-operations";
import { type PlanTimeAdviceInput, type PlanTimeToCoverInput } from "../time-advice-contract";
import { type PlanContext } from "./plan-context";
import { computePlan } from "./replan";
import { getChangePlanning } from "./steered-areas";

/**
 * A time is planned as the save that sets it plans it: a week asked about is onboarding's, saved
 * with a rebuild, and the goal's own week takes a learner's change, which brings set-aside work
 * back and lays today out again. A change is planned by its kind alone, so any time stands in.
 */
export function getTimePlanning(week: PlanTimeToCoverInput) {
  return isAskedWeek(week)
    ? { mode: "forced" as const }
    : getChangePlanning([{ kind: "setDailyMinutes", minutes: MIN_DAILY_MINUTES }]);
}

function isAskedWeek(week: PlanTimeToCoverInput) {
  return week.studyDays !== undefined || week.weekendMinutes !== undefined;
}

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

/** The time the question and the Plan suggest is the time that covers the goal once it's set. */
export function searchPlanTime({
  context,
  week = {},
}: {
  context: PlanContext;
  week?: PlanTimeToCoverInput;
}) {
  const stateAt = (dailyMinutes: number) => withStudyWeek({ context, dailyMinutes, input: week });

  const searchStart = isAskedWeek(week) ? MIN_DAILY_MINUTES : context.state.goal.dailyMinutes;

  return computePlan({
    ...getTimePlanning(week),
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
