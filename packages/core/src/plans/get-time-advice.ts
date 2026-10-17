import "server-only";
import { loadGoalDateKind } from "../exams/_utils/goal-date-estimate";
import { isPlanReady } from "./_utils/apply-plan-change";
import { planLearnerChange } from "./_utils/learner-change";
import { findOwnedPlan } from "./_utils/owned-plan";
import { applyChangeOperations } from "./_utils/part-areas";
import { type PlanContext } from "./_utils/plan-context";
import { roundShare } from "./_utils/plan-feasibility-view";
import { buildPlanNumbersView } from "./_utils/plan-numbers-view";
import { isPlanSetupTaskOwed } from "./_utils/plan-setup-tasks";
import { computePlan } from "./_utils/replan";
import { getChangePlanning } from "./_utils/steered-areas";
import { getNoticeWaitState } from "./notice-wait";
import { type LearnerPlanOperation } from "./plan-contract";
import { FITTING_DATE_TRIES } from "./planner/fitting-date";
import { addDays, toIsoDate } from "./planner/plan-calendar";
import { type PlannedItem } from "./planner/plan-items";
import { applyPlanOperations } from "./planner/plan-operations";
import { MIN_DAILY_MINUTES, type PlanState } from "./planner/plan-state";
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
 * after changing study days or weekends. The scalar also budgets a rested first day.
 */
function withStudyWeek({
  context,
  dailyMinutes,
  input,
}: {
  context: PlanContext;
  dailyMinutes: number;
  input: PlanTimeToCoverInput;
}): PlanState {
  const result = applyPlanOperations({
    goalKind: context.goal.kind,
    operations: getScheduleOperations({ input: { ...input, dailyMinutes }, state: context.state }),
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

/** Lessons a plan keeps set aside: the ones a change didn't bring back (see `splitExistingItems`). */
function countSetAside(items: readonly Pick<PlannedItem, "kind" | "status">[]): number {
  return items.filter(
    (item) => (item.kind === "lesson" || item.kind === "chapter") && item.status === "skipped",
  ).length;
}

/**
 * The plan without its date, as a learner's change plans it: everything left comes back (but
 * lessons the Library couldn't write, which stay set aside), laid out at the learner's time.
 */
async function planWithoutDate(context: PlanContext) {
  const operations: LearnerPlanOperation[] = [{ kind: "setTargetDate", targetDate: null }];
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
 * The earliest date a goal's own time covers everything left by, for a goal that isn't an exam
 * (an exam's date is the exam's): the day after the plan without a date ends (its lessons end
 * before its date), a day later at a time when a dated plan lays them out otherwise. Each try plans
 * the change itself, so the date is one `setTargetDate` applies as found, lessons a change keeps
 * set aside included. Null when none of the tries covers everything.
 */
async function findCoveringDate(context: PlanContext): Promise<string | null> {
  const open = await planWithoutDate(context);
  const end = open?.built.estimate.endDate;

  if (!open || !end) {
    return null;
  }

  const kept = countSetAside(open.built.items);

  for (const days of Array.from({ length: FITTING_DATE_TRIES }, (_, index) => index + 1)) {
    const targetDate = toIsoDate(addDays(end, days));
    const operations: LearnerPlanOperation[] = [{ kind: "setTargetDate", targetDate }];

    // oxlint-disable-next-line no-await-in-loop -- the earliest date that fits wins, so each try waits for the one before it.
    const change = await planLearnerChange({ context, operations, reuseReadBuild: true });

    if (
      change &&
      !change.unchanged &&
      change.computed.built.droppedSkillIds.length === 0 &&
      countSetAside(change.computed.built.items) <= kept
    ) {
      return targetDate;
    }
  }

  return null;
}

/**
 * What the time a day the learner is looking at covers by the goal's date (see `PlanTimeAdvice`),
 * in the week they'd study (its days, and the weekend's own time, which a new daily time leaves as
 * it is): the plan that time plans, read as the plan reveal reads it, so the two say the same share.
 * Only that time's own plan: the time that covers everything is the learner's to ask for (see
 * `findPlanTimeToCover`).
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

  const [computed, dateKind] = await Promise.all([
    computePlan({
      context,
      mode: "forced",
      pace: "saved",
      state: withStudyWeek({ context, dailyMinutes, input }),
    }),
    loadGoalDateKind(context.goal),
  ]);

  const { feasibility } = computed;

  return {
    advice: {
      coveredShare: feasibility.deadline ? roundShare(feasibility.coveredShare) : null,
      measure: feasibility.measure,
      numbers: await buildPlanNumbersView({ computed, context }),
      readingNotice: false,
      ready: true,
      targetDate: context.goal.targetDate ? toIsoDate(context.goal.targetDate) : null,
      targetDateNamedMonth: dateKind.namedMonth,
    },
    status: "ready",
  };
}

/**
 * The daily time that studies the learner's whole goal in depth by its date (see
 * `PlanTimeToCover`), in the week they'd study, found by planning the goal at each daily time from
 * the least: exact, and only when the learner asks ("Find the time that covers everything"), never
 * for a page or prefetch. When no daily time does, what the most time a day covers. For a goal that
 * isn't an exam and falls short in its own week, also the earliest date its own time covers
 * everything by, which "Move your date to cover everything" applies.
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
        maximum: null,
        measure: "goal",
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
  const { maximum } = feasibility;

  // The date is for the plan's own week: another week asked about isn't one a date move keeps.
  const ownWeek = input.studyDays === undefined && input.weekendMinutes === undefined;
  const movesDate = ownWeek && context.goal.kind !== "exam" && !feasibility.fits;

  return {
    status: "ready",
    time: {
      coreMinutes: feasibility.coreMinutes,
      fittingDate: movesDate && context.goal.targetDate ? await findCoveringDate(context) : null,
      maximum: maximum && { ...maximum, coveredShare: roundShare(maximum.coveredShare) },
      measure: feasibility.measure,
      readingNotice: false,
      ready: true,
      recommendedMinutes: feasibility.recommendedMinutes,
      targetDate: context.goal.targetDate ? toIsoDate(context.goal.targetDate) : null,
      targetDateNamedMonth: dateKind.namedMonth,
    },
  };
}
