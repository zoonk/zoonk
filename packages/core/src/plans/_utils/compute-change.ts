import "server-only";
import { isDeepStrictEqual } from "node:util";
import { findActiveSubscription } from "../../auth/subscription";
import { type PlanOperation } from "../plan-contract";
import { getAreaStarts, hasFocusGain, hasReduceEffect } from "../planner/focus-gain";
import { getNextMockMove } from "../planner/next-mock-move";
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
import { type ComputedPlan, computePlan } from "./replan";
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

/**
 * Operations that only choose and arrange the plan's lessons: when no lesson moves, they change
 * nothing (an area with no foundations to start past, a light week after the plan ends, a quick
 * lesson for a base whose core the learner studied).
 */
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

/**
 * A change that would leave the learner's plan as it is: the goal's dates and time, the graph and
 * every lesson on the same day, and nothing else it sets (a light week after the plan ends); for a
 * focus, the areas it asks more of (see `getAskedAreas`) would neither start earlier nor get more
 * of their lessons (see `hasFocusGain`): they already come as early as what they build on allows,
 * however the time they now share moves an area focused before. It isn't offered, so a learner is
 * never told something changed when nothing did. `requested` is the state the
 * operations asked for; `baseline` is the plan re-planned the same way without them, so lessons
 * the Library outlined since the plan was saved never make a change look like it does something.
 */
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
  /** A day of practice on every topic lies ahead, which a focus orders (see `findReviewAhead`). */
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

  // A focus is asked for an area to come first or get more of it, and less of an area for it to
  // get less or come later: anything less isn't one. A review day ahead puts a new focus's topics
  // first, so that focus does something.
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

/**
 * The day the week's mocks or challenges move to when a change to the learner's days moves them
 * (a rest day on the day they were on), so the card says where they go, not only that a day is
 * free. Null when they stay, or the plan has none ahead.
 */
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

/**
 * What a change does to the plan the learner sees (`shown`): the lessons it adds or removes, the
 * ones it leaves out whole by name, the notice topics it brings in or leaves out, when the topics
 * the learner adds start, the end the plan's graph sizes before and after (the one every screen
 * shows), and for a focus, when each focused area starts against the day the plan they see has it,
 * so "first" is never promised where what it builds on still comes before, nor "physics keeps its
 * basics" where its topics leave the plan, and the review day ahead its topics open: a class test's
 * day before has no lessons to move, only its questions. Read against the plan re-planned without
 * the change, a topic an earlier run already left out was said to "leave" (Lucas's "Origin and
 * evolution", out of his plan before his change). The day the next mock moves to is said too,
 * unless the week's mock day moves (`weeklyEvents` says it).
 */
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
  /** The next review day ahead, which a focus opens with its topics (see `findReviewAhead`). */
  reviewDate: string | null;
  /** The plan's items as saved: what the learner sees now. */
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

/** A change to the plan, planned, with what it does and whether it does anything at all. */
export type ComputedChange = {
  /**
   * The plan brings work set aside for time back to compete (see `pickSetAsidePlans`): moving the
   * phase dates right after the change is planned the same way (see `askPhaseDatesAfterChange`).
   */
  bringsBackSetAside: boolean;
  computed: ComputedPlan;
  /**
   * More or less of some areas would do the opposite of what it asks in the plan the learner sees
   * (see `contradictsSteering`): neither offered nor applied when the learner asks for it.
   */
  contradicts: boolean;
  effect: PlanEffect;
  /**
   * The plan would stay as it is (see `hasNoEffect`), or the change `contradicts`: nothing to offer
   * or apply.
   */
  unchanged: boolean;
};

/**
 * The first day ahead that gives its time to practice on every topic, which puts the plan's focus
 * first, for a test days away (a class test): a review day, or a mock's day when the learner's
 * plan has no mocks (a free plan's full review). A plan with weeks to go changes its lessons with a
 * focus, so its reviews weeks ahead say nothing about it. Null when none lies ahead.
 */
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

/**
 * The plan a change makes and the plan re-planned the same way without it. A change of where to
 * focus moves time between areas and keeps the phase end dates the learner sees (see
 * `keepPhaseEnds`): with them planned again as the lessons fall, missed days pushed every phase
 * later, and a focus on the portfolio ended it a day later, while "less English" on a plan of
 * English alone pulled its end two months earlier. Moving the phase dates (Today's proposal)
 * starts from the plan that keeps them and moves what the proposal said it would (see
 * `planPhaseDatesMove`). A change made only of base choices is planned both bringing back work set
 * aside for time and leaving it out (see `pickSetAsidePlans`).
 */
async function planWithAndWithout({
  context,
  operations,
  state,
}: {
  context: PlanContext;
  operations: readonly PlanOperation[];
  state: PlanState;
}): Promise<{ baseline: ComputedPlan; bringsBackSetAside: boolean; computed: ComputedPlan }> {
  // Planned as the system run that proposed it (this week as the learner sees it), so the dates
  // it moves to are the ones the proposal said.
  if (operations.some((operation) => operation.kind === "fitPhaseDates")) {
    const baseline = await computePlan({ context, mode: "automatic" });

    const computed = await planPhaseDatesMove({
      context,
      kept: baseline.built,
      mode: "automatic",
      pace: "saved",
      state,
    });

    return { baseline, bringsBackSetAside: false, computed };
  }

  // Both bring back work set aside for time where it fits (or both leave it out), so the change's
  // effect is its own.
  const request = { ...getChangePlanning(operations), context };

  const plan = async (planning: typeof request) => {
    const [baseline, computed] = await Promise.all([
      computePlan(planning),
      computePlan({ ...planning, state }),
    ]);

    return { baseline, computed };
  };

  if (!plansSetAsideBothWays({ items: context.items, operations })) {
    return { ...(await plan(request)), bringsBackSetAside: true };
  }

  const [brought, kept] = await Promise.all([
    plan(request),
    plan({ ...request, bringBackSetAside: false }),
  ]);

  return pickSetAsidePlans({ brought, kept, shown: context.items });
}

/**
 * Plans a change from today next to the plan re-planned the same way without it, so what the
 * learner is told it does (and whether it does anything) is the change's own doing, not lessons
 * the Library outlined or days that passed since the plan was saved (see `planWithAndWithout`).
 */
export async function computeChange({
  context,
  operations,
  state,
}: {
  context: PlanContext;
  operations: readonly PlanOperation[];
  state: PlanState;
}): Promise<ComputedChange> {
  const { baseline, bringsBackSetAside, computed } = await planWithAndWithout({
    context,
    operations,
    state,
  });

  const reviewDate = await findReviewAhead({ computed, context });
  const reviewsAhead = reviewDate !== null;

  const contradicts = contradictsSteering({
    baseline,
    computed,
    operations,
    reviewsAhead,
    shown: context.items,
  });

  return {
    bringsBackSetAside,
    computed,
    contradicts,
    effect: getChangeEffect({
      baseline,
      computed,
      operations,
      reviewDate,
      shown: context.items,
      today: context.today,
    }),
    unchanged:
      contradicts ||
      hasNoEffect({ baseline, computed, context, operations, requested: state, reviewsAhead }),
  };
}
