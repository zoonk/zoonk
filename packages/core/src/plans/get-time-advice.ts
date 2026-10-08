import "server-only";
import { isPlanReady } from "./_utils/apply-plan-change";
import { findOwnedPlan } from "./_utils/owned-plan";
import { computePlan } from "./_utils/replan";
import { toIsoDate } from "./planner/plan-calendar";
import { DAYS_PER_WEEK, type PlanState } from "./planner/plan-state";
import { type PlanTimeAdvice, type PlanTimeAdviceInput } from "./time-advice-contract";

export type PlanTimeAdviceResult =
  | { advice: PlanTimeAdvice; status: "ready" }
  | { status: "notFound" | "unauthorized" };

const BUILDING: PlanTimeAdvice = {
  maximum: null,
  measure: "goal",
  ready: false,
  recommendedMinutes: null,
  targetDate: null,
};

/** The plan's state studying on these weekdays, at the goal's daily time on each; as it is without. */
function withStudyDays({
  state,
  studyDays,
}: {
  state: PlanState;
  studyDays: readonly number[] | undefined;
}): PlanState {
  if (!studyDays) {
    return state;
  }

  if (studyDays.length === DAYS_PER_WEEK) {
    return { ...state, settings: { ...state.settings, weekdayMinutes: null } };
  }

  const weekdayMinutes = Array.from({ length: DAYS_PER_WEEK }, (_, weekday) =>
    studyDays.includes(weekday) ? state.goal.dailyMinutes : 0,
  );

  return { ...state, settings: { ...state.settings, weekdayMinutes } };
}

/**
 * The daily time the learner's goal needs (see `PlanTimeAdvice`), on the weekdays they'd study:
 * what onboarding's time question recommends and picks first, read from the goal's plan as the
 * plan reveal reads it, so the two say the same number. `ready` is false while the plan is being
 * built.
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

  if (context.phases.length === 0 || !isPlanReady(context)) {
    return { advice: BUILDING, status: "ready" };
  }

  const { feasibility } = await computePlan({
    context,
    mode: "forced",
    pace: "saved",
    state: withStudyDays({ state: context.state, studyDays: input.studyDays }),
  });

  return {
    advice: {
      maximum: feasibility.maximum,
      measure: feasibility.measure,
      ready: true,
      recommendedMinutes: feasibility.recommendedMinutes,
      targetDate: context.goal.targetDate ? toIsoDate(context.goal.targetDate) : null,
    },
    status: "ready",
  };
}
