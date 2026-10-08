import "server-only";
import { isDeepStrictEqual } from "node:util";
import { findActiveSubscription } from "../../auth/subscription";
import { type PlanOperation } from "../plan-contract";
import { getAreaStarts, hasFocusGain } from "../planner/focus-gain";
import { getFocusTargets, getTargetOf } from "../planner/focus-targets";
import { getWeeklyEventWeekday, toIsoDate } from "../planner/plan-calendar";
import {
  type PlanEffect,
  type WeeklyEventMove,
  getFittedStandInLessons,
  getPlanEffect,
  getTopicChanges,
} from "../planner/plan-effect";
import { type PlanState } from "../planner/plan-state";
import { isShortExam } from "../planner/short-exam-plan";
import { type PlanContext, getStateTargetDate } from "./plan-context";
import { type ComputedPlan, computePlan, getGoalUpdate, hasSameItems } from "./replan";

/**
 * Operations that only choose and arrange the plan's lessons: when no lesson moves, they change
 * nothing (an area with no foundations to start past, a light week after the plan ends).
 */
const ARRANGING_OPERATIONS: ReadonlySet<PlanOperation["kind"]> = new Set([
  "addLightWeek",
  "focusAreas",
  "moveWeeklyEvent",
  "reduceAreas",
  "restoreAreas",
  "setAreaStart",
  "skipAreas",
]);

/**
 * What the change's focus asks for: each area it names, or the part of one the learner named, as
 * the computed plan reads them.
 */
function getChangeFocus({
  computed,
  operations,
}: {
  computed: ComputedPlan;
  operations: readonly PlanOperation[];
}): { areaOf: (skillId: string) => string | null; areas: string[] } {
  const targets = getFocusTargets({
    areas: operations.flatMap((operation) =>
      operation.kind === "focusAreas" ? operation.areas : [],
    ),
    graph: computed.state.graph,
    settings: computed.state.settings,
  });

  return { areaOf: getTargetOf(targets), areas: targets.map((target) => target.name) };
}

/**
 * A change that would leave the learner's plan as it is: the goal's dates and time, the graph and
 * every lesson on the same day, and nothing else it sets (a light week after the plan ends); for a
 * focus, an area that would neither start earlier nor get more of its lessons (see
 * `hasFocusGain`): one that already comes as early as what it builds on allows. It isn't offered, so a
 * learner is never told something changed when nothing did. `requested` is the state the
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

  const focus = getChangeFocus({ computed, operations });

  // A focus is asked for an area to come first or get more of it: anything less isn't one. A
  // review day ahead puts a new focus's topics first, so that focus does something.
  if (keepsGoal && focus.areas.length > 0 && operations.every((op) => op.kind === "focusAreas")) {
    const refocuses =
      reviewsAhead && !isDeepStrictEqual(requested.settings, context.state.settings);

    return (
      !refocuses &&
      !hasFocusGain({ ...focus, after: computed.built.items, before: baseline.built.items })
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
 * What a change itself does: the lessons it adds or removes against the plan re-planned without
 * it, the notice topics it brings in or leaves out, the end the plan's graph sizes before and
 * after (the one every screen shows), and for a focus, when each focused area starts, so "first"
 * is never promised where what it builds on still comes before, nor "physics keeps its basics"
 * where its topics leave the plan, and the review day ahead its topics open: a class test's day
 * before has no lessons to move, only its questions.
 */
function getChangeEffect({
  baseline,
  computed,
  operations,
  reviewDate,
}: {
  baseline: ComputedPlan;
  computed: ComputedPlan;
  operations: readonly PlanOperation[];
  /** The next review day ahead, which a focus opens with its topics (see `findReviewAhead`). */
  reviewDate: string | null;
}): PlanEffect {
  // Each plan's stand-ins by the part of them that fits, so a skill a change only starts counts
  // the lessons it brings in, not all of them.
  const lessons = getPlanEffect({
    after: computed.built.items,
    before: baseline.built.items,
    standInLessons: getFittedStandInLessons({
      skillMinutes: computed.built.skillMinutes,
      standInLessons: computed.standInLessons,
    }),
    standInLessonsBefore: getFittedStandInLessons({
      skillMinutes: baseline.built.skillMinutes,
      standInLessons: baseline.standInLessons,
    }),
  });

  const focus = getChangeFocus({ computed, operations });
  const weeklyEvents = getWeeklyEventMove({ baseline, computed });

  const topics = getTopicChanges({
    after: computed.built.items,
    before: baseline.built.items,
    graph: {
      ...computed.state.graph,
      skills: [
        ...computed.state.graph.skills,
        ...baseline.state.graph.skills.filter(
          (skill) => !computed.state.graph.skills.some((other) => other.skillId === skill.skillId),
        ),
      ],
    },
  });

  return {
    ...lessons,
    ...(topics.topicsAdded.length > 0 && { topicsAdded: topics.topicsAdded }),
    ...(topics.topicsLeftOut.length > 0 && { topicsLeftOut: topics.topicsLeftOut }),
    ...(focus.areas.length > 0 && {
      areaStarts: getAreaStarts({
        ...focus,
        after: computed.built.items,
        before: baseline.built.items,
      }),
    }),
    ...(focus.areas.length > 0 &&
      reviewDate && { reviewFirst: { areas: focus.areas, date: reviewDate } }),
    ...(weeklyEvents && { weeklyEvents }),
    endDateAfter: toIsoOrNull(computed.feasibility.endDate),
    endDateBefore: toIsoOrNull(baseline.feasibility.endDate),
  };
}

/** A change to the plan, planned, with what it does and whether it does anything at all. */
export type ComputedChange = {
  computed: ComputedPlan;
  effect: PlanEffect;
  /** The plan would stay as it is (see `hasNoEffect`): nothing to offer or apply. */
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
 * Plans a change from today next to the plan re-planned the same way without it, so what the
 * learner is told it does (and whether it does anything) is the change's own doing, not lessons
 * the Library outlined or days that passed since the plan was saved.
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
  const [baseline, computed] = await Promise.all([
    computePlan({ context, mode: "forced" }),
    computePlan({ context, mode: "forced", state }),
  ]);

  const reviewDate = await findReviewAhead({ computed, context });

  return {
    computed,
    effect: getChangeEffect({ baseline, computed, operations, reviewDate }),
    unchanged: hasNoEffect({
      baseline,
      computed,
      context,
      operations,
      requested: state,
      reviewsAhead: reviewDate !== null,
    }),
  };
}
