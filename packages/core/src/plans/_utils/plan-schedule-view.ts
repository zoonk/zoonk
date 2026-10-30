import "server-only";
import { type loadGoalDateKind } from "../../exams/_utils/goal-date-estimate";
import { type loadNoticeDates } from "../../exams/_utils/notice-day";
import { type PlanView } from "../plan-view-contract";
import {
  countStudyDays,
  type getPlanCalendar,
  getWeekdayMinutes,
  toIsoDate,
} from "../planner/plan-calendar";
import { DAYS_PER_WEEK } from "../planner/plan-state";
import { getWeekShape } from "../planner/week-shape";
import { getMockSchedule } from "./mock-schedule";
import { type PlanReadContext } from "./plan-read-projection";

export function buildScheduleView({
  calendar,
  context,
  dateKind,
  fullCourse,
  noticeDates,
}: {
  calendar: ReturnType<typeof getPlanCalendar>;
  context: PlanReadContext;
  dateKind: Awaited<ReturnType<typeof loadGoalDateKind>>;
  fullCourse: boolean;
  noticeDates: Awaited<ReturnType<typeof loadNoticeDates>>;
}): PlanView["schedule"] {
  const { goal, items, state, today } = context;

  const weekdayMinutes = Array.from({ length: DAYS_PER_WEEK }, (_, weekday) =>
    getWeekdayMinutes({ calendar, weekday }),
  );

  return {
    dailyMinutes: goal.dailyMinutes,
    fullCourse,
    lightWeeks: state.settings.lightWeeks,
    mocks: getMockSchedule({ items, today }),
    nextSitting: fullCourse ? noticeDates.nextSitting : null,
    noSitting: noticeDates.noSitting,
    noticeDay: noticeDates.day,
    shape: getWeekShape({ dailyMinutes: goal.dailyMinutes, weekdayMinutes }),
    studyDays: countStudyDays(calendar),
    targetDate: goal.targetDate ? toIsoDate(goal.targetDate) : null,
    targetDateEstimated: dateKind.estimated,
    targetDateNamedMonth: dateKind.namedMonth,
    weekdayMinutes,
  };
}
