import "server-only";
import { loadGoalDateKind } from "../exams/_utils/goal-date-estimate";
import { isPlanReady } from "./_utils/apply-plan-change";
import { findOwnedPlan } from "./_utils/owned-plan";
import { roundShare } from "./_utils/plan-feasibility-view";
import { buildPlanNumbersView } from "./_utils/plan-numbers-view";
import { isPlanSetupTaskOwed } from "./_utils/plan-setup-tasks";
import { computePlan } from "./_utils/replan";
import { getNoticeWaitState } from "./notice-wait";
import { toIsoDate } from "./planner/plan-calendar";
import { applyPlanOperations } from "./planner/plan-operations";
import { MIN_DAILY_MINUTES, type PlanState } from "./planner/plan-state";
import { getScheduleOperations } from "./planner/schedule-operations";
import { type PlanTimeAdvice, type PlanTimeAdviceInput } from "./time-advice-contract";

export type PlanTimeAdviceResult =
  | { advice: PlanTimeAdvice; status: "ready" }
  | { status: "notFound" | "unauthorized" };

const BUILDING: PlanTimeAdvice = {
  coveredShare: null,
  maximum: null,
  measure: "goal",
  numbers: null,
  readingNotice: false,
  ready: false,
  recommendedMinutes: null,
  targetDate: null,
  targetDateNamedMonth: false,
};

/**
 * An explicit weekend starts the recommendation search at the least daily time. Every candidate
 * reapplies that override to the original saved calendar, even when it equals the candidate time.
 */
function getAdviceWeekdayMinutes({
  input,
  state,
}: {
  input: PlanTimeAdviceInput;
  state: PlanState;
}): number {
  return input.weekendMinutes === undefined ? state.goal.dailyMinutes : MIN_DAILY_MINUTES;
}

/**
 * Apply the same complete schedule operations as updateGoal, including the scalar normalized
 * after changing study days or weekends. The scalar also budgets a rested first day.
 */
function withStudyWeek({
  dailyMinutes,
  input,
  state,
  goalKind,
  today,
}: {
  dailyMinutes: number;
  input: PlanTimeAdviceInput;
  state: PlanState;
  goalKind: Parameters<typeof applyPlanOperations>[0]["goalKind"];
  today: Date;
}): PlanState {
  const result = applyPlanOperations({
    goalKind,
    operations: getScheduleOperations({ input: { ...input, dailyMinutes }, state }),
    state,
    today,
  });

  if ("error" in result) {
    throw new Error(`Cannot evaluate the study schedule: ${result.error}`);
  }

  return result.state;
}

/**
 * The daily time the learner's goal needs (see `PlanTimeAdvice`), in the week they'd study (its
 * days, and the weekend's own time, which a new daily time leaves as it is): what onboarding's time
 * question recommends and picks first, read from the goal's plan as the plan reveal reads it, so
 * the two say the same number. With it, what the time the learner is looking at covers by the date
 * (`coveredShare`), the question's live estimate: a second plan when that's another time than the
 * one the recommendation reads, since a time already at the most a day must not change what's
 * recommended (see `getMaximum`). `ready` is false while the plan is being built, while it still
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

  // What the recommendation reads (the week at the goal's time, see `getAdviceWeekdayMinutes`)
  // and what the time the learner is looking at covers: one plan when they're the same time.
  const adviceMinutes = getAdviceWeekdayMinutes({ input, state: context.state });
  const pickedMinutes = input.dailyMinutes ?? context.state.goal.dailyMinutes;

  const stateAt = (dailyMinutes: number) =>
    withStudyWeek({
      dailyMinutes,
      goalKind: context.goal.kind,
      input,
      state: context.state,
      today: context.today,
    });

  const [recommended, picked, dateKind] = await Promise.all([
    computePlan({
      context,
      mode: "forced",
      pace: "saved",
      state: stateAt(adviceMinutes),
      /** Every candidate starts from the saved state and retains acceptance's normalized scalar. */
      studyScheduleAt: (dailyMinutes) => {
        const state = stateAt(dailyMinutes);

        return {
          dailyMinutes: state.goal.dailyMinutes,
          weekdayMinutes: state.settings.weekdayMinutes,
        };
      },
    }),
    pickedMinutes === adviceMinutes
      ? null
      : computePlan({ context, mode: "forced", pace: "saved", state: stateAt(pickedMinutes) }),
    loadGoalDateKind(context.goal),
  ]);

  const { feasibility } = recommended;
  const selected = picked ?? recommended;
  const pickedFeasibility = selected.feasibility;

  return {
    advice: {
      coveredShare: pickedFeasibility.deadline ? roundShare(pickedFeasibility.coveredShare) : null,
      maximum: feasibility.maximum,
      measure: feasibility.measure,
      numbers: await buildPlanNumbersView({ computed: selected, context }),
      readingNotice: false,
      ready: true,
      recommendedMinutes: feasibility.recommendedMinutes,
      targetDate: context.goal.targetDate ? toIsoDate(context.goal.targetDate) : null,
      targetDateNamedMonth: dateKind.namedMonth,
    },
    status: "ready",
  };
}
