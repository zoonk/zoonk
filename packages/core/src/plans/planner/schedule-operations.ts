import { type GoalUpdateInput } from "../../goals/goal-contract";
import { type LearnerPlanOperation } from "../plan-contract";
import { getWeekdayMinutes } from "./plan-calendar";
import { DAYS_PER_WEEK, type PlanState } from "./plan-state";

type ScheduleInput = Pick<GoalUpdateInput, "dailyMinutes" | "targetDate" | "weekendMinutes"> & {
  studyDays?: readonly number[];
};

const SATURDAY = 6;
const SUNDAY = 0;

/**
 * Study days become rest days at 0 minutes, and new study days get the daily time. A weekend time
 * goes to Saturday and Sunday when they're study days.
 */
function getStudyDayOperations({ state, input }: { state: PlanState; input: ScheduleInput }) {
  const { studyDays, weekendMinutes } = input;

  if (!studyDays && weekendMinutes === undefined) {
    return [];
  }

  const calendar = {
    dailyMinutes: state.goal.dailyMinutes,
    weekdayMinutes: state.settings.weekdayMinutes,
  };

  const weekdays = Array.from({ length: DAYS_PER_WEEK }, (_, weekday) => weekday);
  const current = (weekday: number) => getWeekdayMinutes({ calendar, weekday });

  const studies = (weekday: number) =>
    studyDays ? studyDays.includes(weekday) : current(weekday) > 0;

  const rest = weekdays.filter((weekday) => !studies(weekday) && current(weekday) > 0);
  const added = weekdays.filter((weekday) => studies(weekday) && current(weekday) === 0);
  const minutes = input.dailyMinutes ?? state.goal.dailyMinutes;

  const weekend =
    weekendMinutes === undefined ? [] : [SUNDAY, SATURDAY].filter((weekday) => studies(weekday));

  return [
    /** Add first so replacing every study day never creates an intermediate empty week. */
    added.length > 0 && { kind: "setWeekdayMinutes" as const, minutes, weekdays: added },
    rest.length > 0 && { kind: "setWeekdayMinutes" as const, minutes: 0, weekdays: rest },
    weekend.length > 0 && {
      kind: "setWeekdayMinutes" as const,
      minutes: weekendMinutes ?? minutes,
      weekdays: weekend,
    },
  ].filter((operation) => operation !== false);
}

/** What the update changes about the learner's time and date, as plan operations. */
export function getScheduleOperations({
  state,
  input,
}: {
  state: PlanState;
  input: ScheduleInput;
}): LearnerPlanOperation[] {
  const { goal } = state;

  return [
    input.dailyMinutes !== undefined &&
      input.dailyMinutes !== goal.dailyMinutes && {
        kind: "setDailyMinutes" as const,
        minutes: input.dailyMinutes,
      },
    ...getStudyDayOperations({ input, state }),
    input.targetDate !== undefined &&
      input.targetDate !== goal.targetDate && {
        kind: "setTargetDate" as const,
        targetDate: input.targetDate,
      },
  ].filter((operation) => operation !== false);
}
