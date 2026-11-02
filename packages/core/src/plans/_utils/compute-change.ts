import "server-only";
import { isDeepStrictEqual } from "node:util";
import { findActiveSubscription } from "../../auth/subscription";
import { type PlanOperation } from "../plan-contract";
import { getAreaStarts, hasFocusGain, hasReduceEffect } from "../planner/focus-gain";
import { getNextMockMove } from "../planner/next-mock-move";
import { getPhaseDatesEffect } from "../planner/phase-dates-move";
import { getWeeklyEventWeekday, toIsoDate } from "../planner/plan-calendar";
import {
  type PlanEffect,
  type WeeklyEventMove,
  getAddedSkillsStart,
  startsBeforeBasics,
} from "../planner/plan-effect";
import { type PlanState } from "../planner/plan-state";
import { isShortExam } from "../planner/short-exam-plan";
import { planPhaseDatesMove } from "./moved-phase-dates";
import { type PlanContext, getStateTargetDate } from "./plan-context";
import { getGoalUpdate, hasSameItems } from "./plan-unchanged";
import { type ComputedChange, type ComputedPlan, computePlan } from "./replan";
import { getSeenEffect } from "./seen-effect";
import { pickSetAsidePlans, plansSetAsideBothWays } from "./set-aside-plans";
import {
  contradictsSteering,
  getAskedFocus,
  getChangeFocus,
  getChangePlanning,
  getReducedAreas,
  getSteeredEnds,
  getUnnamedAreaLessons,
} from "./steered-areas";

const ARRANGING_OPERATIONS: ReadonlySet<PlanOperation["kind"]> = new Set([
  "addLightWeek",
  "focusAreas",
  "moveWeeklyEvent",
  "reduceAreas",
  "restoreAreas",
  "setAreaStart",
  "setBaseChoices",
  "skipAreas",
]);

function hasNoEffect({
  baseline,
  computed,
  context,
  operations,
  requested,
  reviewsAhead,
}: {
  baseline: ComputedPlan;
  computed: ComputedPlan;
  context: PlanContext;
  operations: readonly PlanOperation[];
  requested: PlanState;
  reviewsAhead: boolean;
}): boolean {
  const onlyArranges =
    isDeepStrictEqual(requested.settings, context.state.settings) ||
    operations.every((operation) => ARRANGING_OPERATIONS.has(operation.kind));

  const keepsGoal =
    getGoalUpdate({ context, state: computed.state }) === null &&
    isDeepStrictEqual(requested.graph, context.state.graph);

  const focus = getAskedFocus({ baseline, computed, operations });
  const reduced = getReducedAreas({ computed, operations });

  const steers = operations.every(
    (operation) => operation.kind === "focusAreas" || operation.kind === "reduceAreas",
  );

  if (keepsGoal && steers) {
    const items = { after: computed.built.items, before: baseline.built.items };

    const refocuses =
      focus.areas.length > 0 &&
      reviewsAhead &&
      !isDeepStrictEqual(requested.settings, context.state.settings);

    return (
      !refocuses &&
      !(focus.areas.length > 0 && hasFocusGain({ ...focus, ...items })) &&
      !(reduced.areas.length > 0 && hasReduceEffect({ ...reduced, ...items }))
    );
  }

  return (
    onlyArranges &&
    keepsGoal &&
    hasSameItems({ after: computed.built.items, before: baseline.built.items })
  );
}

function toIsoOrNull(date: Date | null): string | null {
  return date ? toIsoDate(date) : null;
}

function getEventWeekday(plan: ComputedPlan): number {
  return getWeeklyEventWeekday({
    dailyMinutes: plan.state.goal.dailyMinutes,
    weekdayMinutes: plan.state.settings.weekdayMinutes,
  });
}

function getWeeklyEventMove({
  baseline,
  computed,
}: {
  baseline: ComputedPlan;
  computed: ComputedPlan;
}): WeeklyEventMove | null {
  const ahead = computed.built.items.filter((item) => item.status === "todo");
  const hasMocks = ahead.some((item) => item.kind === "mock");
  const hasChallenges = ahead.some((item) => item.kind === "checkpoint");
  const [before, after] = [getEventWeekday(baseline), getEventWeekday(computed)];

  if (before === after || (!hasMocks && !hasChallenges)) {
    return null;
  }

  return { after, before, kind: hasMocks ? "mock" : "challenge" };
}

function getChangeEffect({
  baseline,
  computed,
  operations,
  reviewDate,
  shown,
  today,
}: {
  baseline: ComputedPlan;
  computed: ComputedPlan;
  operations: readonly PlanOperation[];
  reviewDate: string | null;
  shown: PlanContext["items"];
  today: Date;
}): PlanEffect {
  const seen = getSeenEffect({ computed, fallback: baseline, shown });
  const focus = getChangeFocus({ computed, operations });
  const areaEnds = getSteeredEnds({ baseline, computed, focus, operations, shown });
  const areaLessons = getUnnamedAreaLessons({ baseline, computed, operations, shown });
  const weeklyEvents = getWeeklyEventMove({ baseline, computed });

  const nextMock = weeklyEvents
    ? null
    : getNextMockMove({ after: computed.built.items, before: shown, today });

  const addedSkillIds = new Set(
    operations.flatMap((operation) =>
      operation.kind === "addSkills" ? operation.skills.map((skill) => skill.skillId) : [],
    ),
  );

  const addedTopicsStart = getAddedSkillsStart({
    items: computed.built.items,
    skillIds: addedSkillIds,
  });

  const beforeBasics = startsBeforeBasics({ items: computed.built.items, skillIds: addedSkillIds });

  return {
    ...seen,
    ...(addedTopicsStart && { addedTopicsStart }),
    ...(beforeBasics && { addedTopicsBeforeBasics: true }),
    ...(focus.areas.length > 0 && {
      areaStarts: getAreaStarts({ ...focus, after: computed.built.items, before: shown }),
    }),
    ...(areaEnds.length > 0 && { areaEnds }),
    ...(areaLessons.length > 0 && { areaLessons }),
    ...(focus.areas.length > 0 &&
      reviewDate && { reviewFirst: { areas: focus.areas, date: reviewDate } }),
    ...(weeklyEvents && { weeklyEvents }),
    ...(nextMock && { nextMock }),
    endDateAfter: toIsoOrNull(computed.feasibility.endDate),
    endDateBefore: toIsoOrNull(baseline.feasibility.endDate),
  };
}

async function findReviewAhead({
  computed,
  context,
}: {
  computed: ComputedPlan;
  context: PlanContext;
}): Promise<string | null> {
  const targetDate = getStateTargetDate(computed.state);

  if (!targetDate || !isShortExam({ planStart: context.today, targetDate })) {
    return null;
  }

  const ahead = computed.built.items.filter(
    (item) =>
      (item.kind === "review" || item.kind === "mock") &&
      item.status === "todo" &&
      item.scheduledFor !== null &&
      item.scheduledFor.getTime() >= context.today.getTime(),
  );

  const mocksAreReviews =
    ahead.some((item) => item.kind === "mock") &&
    !(await findActiveSubscription(context.goal.userId));

  const days = ahead.flatMap((item) =>
    item.scheduledFor && (item.kind === "review" || mocksAreReviews)
      ? [item.scheduledFor.getTime()]
      : [],
  );

  return days.length > 0 ? toIsoDate(new Date(Math.min(...days))) : null;
}

async function planWithAndWithout({
  context,
  baseline: suppliedBaseline,
  operations,
  state,
}: Parameters<typeof computeChange>[0]): Promise<{
  baseline: ComputedPlan;
  bringsBackSetAside: boolean;
  computed: ComputedPlan;
}> {
  if (operations.some((operation) => operation.kind === "fitPhaseDates")) {
    const baseline = suppliedBaseline ?? (await computePlan({ context, mode: "automatic" }));

    const computed = await planPhaseDatesMove({
      context,
      kept: baseline.built,
      mode: "automatic",
      pace: "saved",
      state,
    });

    return { baseline, bringsBackSetAside: false, computed };
  }

  if (operations.some((operation) => operation.kind === "fitLessons")) {
    const planning = getChangePlanning(operations);

    const [baseline, computed] = await Promise.all([
      suppliedBaseline ?? computePlan({ context, mode: "automatic" }),
      computePlan({ ...planning, context, state }),
    ]);

    return { baseline, bringsBackSetAside: planning.bringBackSetAside, computed };
  }

  const request = { ...getChangePlanning(operations), context };

  const plan = async (planning: typeof request) => {
    const [baseline, computed] = await Promise.all([
      suppliedBaseline ?? computePlan(planning),
      computePlan({ ...planning, state }),
    ]);

    return { baseline, computed };
  };

  if (!plansSetAsideBothWays({ items: context.items, operations })) {
    return { ...(await plan(request)), bringsBackSetAside: request.bringBackSetAside };
  }

  const [brought, kept] = await Promise.all([
    plan(request),
    plan({ ...request, bringBackSetAside: false }),
  ]);

  return pickSetAsidePlans({ brought, kept, shown: context.items });
}

export async function computeChange({
  baseline,
  context,
  operations,
  state,
}: {
  context: PlanContext;
  operations: readonly PlanOperation[];
  baseline?: ComputedPlan;
  state: PlanState;
}): Promise<ComputedChange> {
  const {
    baseline: compared,
    bringsBackSetAside,
    computed,
  } = await planWithAndWithout({ baseline, context, operations, state });

  const reviewDate = await findReviewAhead({ computed, context });

  const contradicts = contradictsSteering({
    baseline: compared,
    computed,
    operations,
    reviewsAhead: reviewDate !== null,
    shown: context.items,
  });

  return {
    baseline: compared,
    bringsBackSetAside,
    computed,
    contradicts,
    effect: {
      ...getChangeEffect({
        baseline: compared,
        computed,
        operations,
        reviewDate,
        shown: context.items,
        today: context.today,
      }),
      ...(computed.effect.phaseEnds && { phaseEnds: computed.effect.phaseEnds }),
      ...(operations.some((operation) => operation.kind === "fitPhaseDates") &&
        getPhaseDatesEffect({
          graph: computed.state.graph,
          kept: compared.built,
          moved: computed.built,
          shown: context.phases,
        })),
    },
    unchanged:
      contradicts ||
      hasNoEffect({
        baseline: compared,
        computed,
        context,
        operations,
        requested: state,
        reviewsAhead: reviewDate !== null,
      }),
  };
}
