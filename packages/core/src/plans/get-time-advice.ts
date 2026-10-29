import "server-only";
import { loadGoalDateKind } from "../exams/_utils/goal-date-estimate";
import { isPlanReady } from "./_utils/apply-plan-change";
import { findOwnedPlan } from "./_utils/owned-plan";
import { applyChangeOperations } from "./_utils/part-areas";
import { type PlanContext } from "./_utils/plan-context";
import { roundShare } from "./_utils/plan-feasibility-view";
import { buildPlanNumbersView } from "./_utils/plan-numbers-view";
import { isPlanSetupTaskOwed } from "./_utils/plan-setup-tasks";
import { computePlan } from "./_utils/replan";
import { getChangePlanning } from "./_utils/steered-areas";
import { MIN_DAILY_MINUTES } from "./daily-minutes";
import { getNoticeWaitState } from "./notice-wait";
import { type LearnerPlanOperation } from "./plan-contract";
import { getFullCourseEnd } from "./planner/after-exam";
import { FITTING_DATE_TRIES } from "./planner/fitting-date";
import { addDays, toIsoDate } from "./planner/plan-calendar";
import { applyPlanOperations } from "./planner/plan-operations";
import { type PlanState } from "./planner/plan-state";
import { getScheduleOperations } from "./planner/schedule-operations";
import { hasCompleteSkillCoverage } from "./planner/skill-minutes";
import {
  type PlanTimeAdvice,
  type PlanTimeAdviceInput,
  type PlanTimeToCover,
  type PlanTimeToCoverInput,
} from "./time-advice-contract";

export type PlanTimeAdviceResult =
  | { advice: PlanTimeAdvice; status: "ready" }
  | { status: "notFound" | "unauthorized" };

export type PlanTimeToCoverResult =
  | { status: "ready"; time: PlanTimeToCover }
  | { status: "notFound" | "unauthorized" };

type Waiting = { readingNotice: boolean; ready: false };

function getSearchWeekdayMinutes({
  input,
  state,
}: {
  input: PlanTimeToCoverInput;
  state: PlanState;
}): number {
  return input.weekendMinutes === undefined ? state.goal.dailyMinutes : MIN_DAILY_MINUTES;
}

function withStudyWeek({
  context,
  dailyMinutes,
  fullCourse = false,
  input,
}: {
  context: PlanContext;
  dailyMinutes: number;
  fullCourse?: boolean;
  input: PlanTimeToCoverInput;
}): PlanState {
  const schedule = getScheduleOperations({
    input: { ...input, dailyMinutes },
    state: context.state,
  });

  const result = applyPlanOperations({
    goalKind: context.goal.kind,
    operations: fullCourse ? [...schedule, { fullCourse, kind: "setFullCourse" }] : schedule,
    state: context.state,
    today: context.today,
  });

  if ("error" in result) {
    throw new Error(`Cannot evaluate the study schedule: ${result.error}`);
  }

  return result.state;
}

async function loadAskedPlan(
  goalId: string,
): Promise<
  { context: PlanContext; status: "ready" } | { status: "notFound" | "unauthorized" } | Waiting
> {
  const owned = await findOwnedPlan({ goalId });

  if (owned.status !== "ready") {
    return owned;
  }

  const { context } = owned;

  const owesPlacement = await isPlanSetupTaskOwed({ goalId, task: "placement" });

  const readingNotice =
    getNoticeWaitState({ noticeWaitUntil: context.plan.noticeWaitUntil, now: new Date() }) ===
    "reading";

  if (context.phases.length === 0 || !isPlanReady(context) || owesPlacement || readingNotice) {
    return { readingNotice, ready: false };
  }

  return { context, status: "ready" };
}

async function planAtDate(context: PlanContext, targetDate: Date | null) {
  const operations: LearnerPlanOperation[] = [
    { kind: "setTargetDate", targetDate: targetDate && toIsoDate(targetDate) },
  ];

  const result = await applyChangeOperations({ context, operations });

  if ("error" in result) {
    return null;
  }

  return computePlan({ ...getChangePlanning(result.operations), context, state: result.state });
}

async function findCoveringDate(context: PlanContext): Promise<string | null> {
  const open = await planAtDate(context, null);
  const end = open?.feasibility.endDate ?? null;

  if (!end) {
    return null;
  }

  for (const days of Array.from({ length: FITTING_DATE_TRIES }, (_, index) => index)) {
    const targetDate = addDays(end, days);

    // oxlint-disable-next-line no-await-in-loop -- the earliest date that fits wins, so each try waits for the one before it.
    const planned = await planAtDate(context, targetDate);

    if (planned?.feasibility.fits) {
      return toIsoDate(targetDate);
    }
  }

  return null;
}

export async function getPlanTimeAdvice({
  goalId,
  input,
}: {
  goalId: string;
  input: PlanTimeAdviceInput;
}): Promise<PlanTimeAdviceResult> {
  const asked = await loadAskedPlan(goalId);

  if ("ready" in asked) {
    return {
      advice: {
        coveredShare: null,
        endDate: null,
        fullCourseEndDate: null,
        measure: "goal",
        numbers: null,
        readingNotice: asked.readingNotice,
        ready: false,
        targetDate: null,
        targetDateNamedMonth: false,
      },
      status: "ready",
    };
  }

  if (asked.status !== "ready") {
    return asked;
  }

  const { context } = asked;
  const dailyMinutes = input.dailyMinutes ?? context.state.goal.dailyMinutes;
  const fullCourse = context.goal.kind === "exam" && input.fullCourse === true;

  const [computed, dateKind] = await Promise.all([
    computePlan({
      context,
      mode: "forced",
      pace: "saved",
      state: withStudyWeek({ context, dailyMinutes, fullCourse, input }),
    }),
    loadGoalDateKind(context.goal),
  ]);

  const { feasibility } = computed;
  const end = computed.built.estimate.endDate;
  const targetDate = context.goal.targetDate ? toIsoDate(context.goal.targetDate) : null;

  return {
    advice: {
      coveredShare: feasibility.deadline ? roundShare(feasibility.coveredShare) : null,
      endDate:
        !targetDate && end && hasCompleteSkillCoverage(computed.built.skillMinutes)
          ? toIsoDate(end)
          : null,
      fullCourseEndDate: fullCourse
        ? getFullCourseEnd({ built: computed.built, end: end && toIsoDate(end), targetDate })
        : null,
      measure: feasibility.measure,
      numbers: await buildPlanNumbersView({ computed, context }),
      readingNotice: false,
      ready: true,
      targetDate,
      targetDateNamedMonth: dateKind.namedMonth,
    },
    status: "ready",
  };
}

/**
 * Plans the goal at each daily time (seconds of CPU for a big exam), so it runs only for a learner's
 * POST, such as onboarding's time question asking once the plan exists: never for a render, a GET,
 * metadata or a prefetch.
 */
export async function findPlanTimeToCover({
  goalId,
  input,
}: {
  goalId: string;
  input: PlanTimeToCoverInput;
}): Promise<PlanTimeToCoverResult> {
  const asked = await loadAskedPlan(goalId);

  if ("ready" in asked) {
    return {
      status: "ready",
      time: {
        coreMinutes: null,
        fittingDate: null,
        readingNotice: asked.readingNotice,
        ready: false,
        recommendedMinutes: null,
        targetDate: null,
        targetDateNamedMonth: false,
      },
    };
  }

  if (asked.status !== "ready") {
    return asked;
  }

  const { context } = asked;
  const stateAt = (dailyMinutes: number) => withStudyWeek({ context, dailyMinutes, input });

  const [computed, dateKind] = await Promise.all([
    computePlan({
      context,
      mode: "forced",
      pace: "saved",
      state: stateAt(getSearchWeekdayMinutes({ input, state: context.state })),
      studyScheduleAt: (dailyMinutes) => {
        const state = stateAt(dailyMinutes);

        return {
          dailyMinutes: state.goal.dailyMinutes,
          weekdayMinutes: state.settings.weekdayMinutes,
        };
      },
    }),
    loadGoalDateKind(context.goal),
  ]);

  const { feasibility } = computed;

  const ownWeek = input.studyDays === undefined && input.weekendMinutes === undefined;
  const pastDate = context.goal.targetDate !== null && context.goal.targetDate < context.today;
  const movesDate = ownWeek && context.goal.kind !== "exam" && (pastDate || !feasibility.fits);

  return {
    status: "ready",
    time: {
      // Nothing covers a date that has passed, so no time is searched for.
      coreMinutes: pastDate ? null : feasibility.coreMinutes,
      fittingDate: movesDate && context.goal.targetDate ? await findCoveringDate(context) : null,
      readingNotice: false,
      ready: true,
      recommendedMinutes: pastDate ? null : feasibility.recommendedMinutes,
      targetDate: context.goal.targetDate ? toIsoDate(context.goal.targetDate) : null,
      targetDateNamedMonth: dateKind.namedMonth,
    },
  };
}
