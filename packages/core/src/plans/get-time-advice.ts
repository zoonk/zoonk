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

/** What the time question can say while the plan isn't ready to be asked. */
type Waiting = { readingNotice: boolean; ready: false };

/**
 * An explicit weekend starts the search for the time a goal needs at the least daily time. Every
 * candidate reapplies that override to the original saved calendar, even when it equals the
 * candidate time.
 */
function getSearchWeekdayMinutes({
  input,
  state,
}: {
  input: PlanTimeToCoverInput;
  state: PlanState;
}): number {
  return input.weekendMinutes === undefined ? state.goal.dailyMinutes : MIN_DAILY_MINUTES;
}

/**
 * Apply the same complete schedule operations as updateGoal, including the scalar normalized
 * after changing study days or weekends. The scalar also budgets a rested first day. An exam
 * studying everything (`fullCourse`) turns that on as its plan change does.
 */
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

/**
 * The learner's plan, once it can be asked about time: not while it's being built, while it still
 * owes the placement the learner ended before it existed, whose test-outs change what it needs,
 * or while it waits for its exam's notice reading (`readingNotice`), which builds it again when it
 * lands (see `getNoticeWaitState`): DELE's time question said 2h50 a day, and the plan built with
 * the notice right after it, 2h40. That wait ends when the reading lands or research ends without
 * one, or runs out (see `startNoticeWait`), and the plan answers as it is from then on.
 */
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

/**
 * The learner's plan with its date moved (null for none), planned as the change that moves it plans
 * it (work set aside for time comes back), read on the measure the plan shows (`PlanFeasibility`).
 */
async function planAtDate(context: PlanContext, targetDate: Date | null) {
  const operations: LearnerPlanOperation[] = [
    { kind: "setTargetDate", targetDate: targetDate && toIsoDate(targetDate) },
  ];

  const result = await applyChangeOperations({ context, operations });

  if ("error" in result) {
    return null;
  }

  return computePlan({
    ...getChangePlanning(result.operations),
    context,
    reuseReadBuild: true,
    state: result.state,
  });
}

/**
 * The earliest date a goal's own time covers everything by, for a goal that isn't an exam (an
 * exam's date is the exam's), on the plan's one measure (see `getSelectedCoverage`): from the day
 * the plan without a date ends, a day at a time, the first date the plan covers everything by, as
 * it then shows (`fits`). So Move applies a date whose plan says it covers everything. Null when
 * none of the tries does.
 */
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

/**
 * What the time a day the learner is looking at covers by the goal's date (see `PlanTimeAdvice`),
 * in the week they'd study (its days, and the weekend's own time, which a new daily time leaves as
 * it is): the plan that time plans, read as the plan reveal reads it, so the two say the same share.
 * For an exam asked about studying everything (`fullCourse`), the plan that does, and the day it
 * ends. Only that time's own plan, built once: the time that covers everything is the learner's to
 * ask for (see `findPlanTimeToCover`).
 */
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
 * The daily time that studies the learner's whole goal in depth by its date (see
 * `PlanTimeToCover`), in the week they'd study, found by planning the goal at each daily time from
 * the least: exact, and only when the learner asks ("Find the time that covers everything"), never
 * for a page or prefetch. For a goal that isn't an exam and falls short in its own week, or whose
 * date passed, also the earliest date its own time covers everything by, measured like the time,
 * which "Move your date" applies.
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
      /** Every candidate starts from the saved state and retains acceptance's normalized scalar. */
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

  // The date is for the plan's own week: another week asked about isn't one a date move keeps. A
  // date that came with lessons left moves too, though nothing measures as left out by it then.
  const ownWeek = input.studyDays === undefined && input.weekendMinutes === undefined;
  const pastDate = context.goal.targetDate !== null && context.goal.targetDate < context.today;
  const movesDate = ownWeek && context.goal.kind !== "exam" && (pastDate || !feasibility.fits);

  return {
    status: "ready",
    time: {
      coreMinutes: feasibility.coreMinutes,
      fittingDate: movesDate && context.goal.targetDate ? await findCoveringDate(context) : null,
      readingNotice: false,
      ready: true,
      recommendedMinutes: feasibility.recommendedMinutes,
      targetDate: context.goal.targetDate ? toIsoDate(context.goal.targetDate) : null,
      targetDateNamedMonth: dateKind.namedMonth,
    },
  };
}
