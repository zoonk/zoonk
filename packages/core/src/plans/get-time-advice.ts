import "server-only";
import { loadGoalDateKind } from "../exams/_utils/goal-date-estimate";
import { isPlanReady } from "./_utils/apply-plan-change";
import { findOwnedPlan } from "./_utils/owned-plan";
import { isPlanSetupTaskOwed } from "./_utils/plan-setup-tasks";
import { computePlan } from "./_utils/replan";
import { getNoticeWaitState } from "./notice-wait";
import { getWeekdayMinutes, toIsoDate } from "./planner/plan-calendar";
import { DAYS_PER_WEEK, MIN_DAILY_MINUTES, type PlanState } from "./planner/plan-state";
import { isWeekend } from "./planner/week-shape";
import { type PlanTimeAdvice, type PlanTimeAdviceInput } from "./time-advice-contract";

export type PlanTimeAdviceResult =
  | { advice: PlanTimeAdvice; status: "ready" }
  | { status: "notFound" | "unauthorized" };

const BUILDING: PlanTimeAdvice = {
  maximum: null,
  measure: "goal",
  readingNotice: false,
  ready: false,
  recommendedMinutes: null,
  targetDate: null,
  targetDateNamedMonth: false,
};

/**
 * The weekdays' time the advice starts from when the weekend has its own time: what a weekday
 * takes is what the advice searches, so it starts from the least, which is never the weekend's
 * own time (the plan reads a weekend at the weekdays' time as no time of its own) or the most a
 * day (at which there's no more time to recommend).
 */
function getStartingWeekdayMinutes(weekendMinutes: number): number {
  return weekendMinutes === MIN_DAILY_MINUTES ? MIN_DAILY_MINUTES + 1 : MIN_DAILY_MINUTES;
}

/**
 * The plan's state studying the week the learner is choosing: these weekdays (the plan's own when
 * absent) at the goal's time a day, or, when the weekend has its own time, the weekend at it and
 * the weekdays at the least time, which the advice then searches (`getStartingWeekdayMinutes`).
 * As it is when the input changes nothing.
 */
function withStudyWeek({ input, state }: { input: PlanTimeAdviceInput; state: PlanState }) {
  const { studyDays, weekendMinutes } = input;

  if (!studyDays && weekendMinutes === undefined) {
    return state;
  }

  const dailyMinutes =
    weekendMinutes === undefined
      ? state.goal.dailyMinutes
      : getStartingWeekdayMinutes(weekendMinutes);

  const calendar = {
    dailyMinutes: state.goal.dailyMinutes,
    weekdayMinutes: state.settings.weekdayMinutes,
  };

  const studies = (weekday: number) =>
    studyDays ? studyDays.includes(weekday) : getWeekdayMinutes({ calendar, weekday }) > 0;

  const minutesOf = (weekday: number) =>
    isWeekend(weekday) && weekendMinutes !== undefined ? weekendMinutes : dailyMinutes;

  const weekdayMinutes = Array.from({ length: DAYS_PER_WEEK }, (_, weekday) =>
    studies(weekday) ? minutesOf(weekday) : 0,
  );

  const isEveryDay = weekdayMinutes.every((minutes) => minutes === dailyMinutes);

  return {
    ...state,
    goal: { ...state.goal, dailyMinutes },
    settings: { ...state.settings, weekdayMinutes: isEveryDay ? null : weekdayMinutes },
  };
}

/**
 * The daily time the learner's goal needs (see `PlanTimeAdvice`), in the week they'd study (its
 * days, and the weekend's own time, which a new daily time leaves as it is): what onboarding's time
 * question recommends and picks first, read from the goal's plan as the plan reveal reads it, so
 * the two say the same number. `ready` is false while the plan is being built, while it still
 * owes the placement the learner ended before it existed, whose test-outs change what it needs,
 * and while it waits for its exam's notice reading (`readingNotice`, which the time question
 * says), which builds it again when it lands (see `getNoticeWaitState`): DELE's time question said
 * 2h50 a day, and the plan built with the notice right after it, 2h40. That wait ends when the
 * reading lands or research ends without one, or runs out (see `startNoticeWait`), and the advice
 * is the plan's as it is from then on, as the reveal's is.
 */
export async function getPlanTimeAdvice({
  goalId,
  input,
}: {
  goalId: string;
  input: PlanTimeAdviceInput;
}): Promise<PlanTimeAdviceResult> {
  const owned = await findOwnedPlan({ goalId });

  if (owned.status !== "ready") {
    return owned;
  }

  const { context } = owned;

  const owesPlacement = await isPlanSetupTaskOwed({ goalId, task: "placement" });
  const { noticeWaitUntil } = context.plan;
  const readsNotice = getNoticeWaitState({ noticeWaitUntil, now: new Date() }) === "reading";

  if (context.phases.length === 0 || !isPlanReady(context) || owesPlacement || readsNotice) {
    return { advice: { ...BUILDING, readingNotice: readsNotice }, status: "ready" };
  }

  const [{ feasibility }, dateKind] = await Promise.all([
    computePlan({
      context,
      mode: "forced",
      pace: "saved",
      state: withStudyWeek({ input, state: context.state }),
    }),
    loadGoalDateKind(context.goal),
  ]);

  return {
    advice: {
      maximum: feasibility.maximum,
      measure: feasibility.measure,
      readingNotice: false,
      ready: true,
      recommendedMinutes: feasibility.recommendedMinutes,
      targetDate: context.goal.targetDate ? toIsoDate(context.goal.targetDate) : null,
      targetDateNamedMonth: dateKind.namedMonth,
    },
    status: "ready",
  };
}
