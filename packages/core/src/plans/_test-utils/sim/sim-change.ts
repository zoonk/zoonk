import { isDeepStrictEqual } from "node:util";
import { getGoalUpdate, hasSameItems } from "../../_utils/plan-unchanged";
import { type ComputedPlan } from "../../_utils/replan";
import { getSeenEffect } from "../../_utils/seen-effect";
import { pickSetAsidePlans, plansSetAsideBothWays } from "../../_utils/set-aside-plans";
import {
  contradictsSteering,
  getAskedFocus,
  getChangeFocus,
  getChangePlanning,
  getReducedAreas,
  getSteeredEnds,
  getUnnamedAreaLessons,
} from "../../_utils/steered-areas";
import { type PlanOperation } from "../../plan-contract";
import { getAreaStarts, hasFocusGain, hasReduceEffect } from "../../planner/focus-gain";
import { getNextMockMove } from "../../planner/next-mock-move";
import { fromIsoDate, getWeeklyEventWeekday, toIsoDate } from "../../planner/plan-calendar";
import {
  type PlanEffect,
  type WeeklyEventMove,
  getAddedSkillsStart,
  startsBeforeBasics,
} from "../../planner/plan-effect";
import { applyPlanOperations } from "../../planner/plan-operations";
import { type PlanState } from "../../planner/plan-state";
import { isShortExam } from "../../planner/short-exam-plan";
import { planSimPhaseDatesMove } from "./sim-phase-dates";
import { computeSimPlan } from "./sim-planner";
import { type SimWorld, toSimContext } from "./sim-world";

/**
 * `computeChange`'s copy (see `sim-planner.ts`): the change planned next to the plan re-planned
 * the same way without it, what the card says it does, and whether it does anything at all.
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

type Planned = { baseline: ComputedPlan; computed: ComputedPlan };

function findReviewAhead({ computed, world }: { computed: ComputedPlan; world: SimWorld }) {
  const { targetDate } = computed.state.goal;
  const { today } = world;

  if (!targetDate || !isShortExam({ planStart: today, targetDate: fromIsoDate(targetDate) })) {
    return null;
  }

  const ahead = computed.built.items.filter(
    (item) =>
      (item.kind === "review" || item.kind === "mock") &&
      item.status === "todo" &&
      item.scheduledFor !== null &&
      item.scheduledFor.getTime() >= today.getTime(),
  );

  const mocksAreReviews = ahead.some((item) => item.kind === "mock") && !world.learner.subscribed;

  const days = ahead.flatMap((item) =>
    item.scheduledFor && (item.kind === "review" || mocksAreReviews)
      ? [item.scheduledFor.getTime()]
      : [],
  );

  return days.length > 0 ? toIsoDate(new Date(Math.min(...days))) : null;
}

function getEventWeekday(plan: ComputedPlan): number {
  return getWeeklyEventWeekday({
    dailyMinutes: plan.state.goal.dailyMinutes,
    weekdayMinutes: plan.state.settings.weekdayMinutes,
  });
}

function getWeeklyEventMove({ baseline, computed }: Planned): WeeklyEventMove | null {
  const ahead = computed.built.items.filter((item) => item.status === "todo");
  const hasMocks = ahead.some((item) => item.kind === "mock");
  const hasChallenges = ahead.some((item) => item.kind === "checkpoint");
  const [before, after] = [getEventWeekday(baseline), getEventWeekday(computed)];

  if (before === after || (!hasMocks && !hasChallenges)) {
    return null;
  }

  return { after, before, kind: hasMocks ? "mock" : "challenge" };
}

function getAddedSkillIds(operations: readonly PlanOperation[]): Set<string> {
  return new Set(
    operations.flatMap((operation) =>
      operation.kind === "addSkills" ? operation.skills.map((skill) => skill.skillId) : [],
    ),
  );
}

/** `getChangeEffect`. */
function getEffect({
  baseline,
  computed,
  operations,
  reviewDate,
  world,
}: Planned & {
  operations: readonly PlanOperation[];
  reviewDate: string | null;
  world: SimWorld;
}): PlanEffect {
  const shown = world.plan.items;
  const after = computed.built.items;
  const focus = getChangeFocus({ computed, operations });
  const areaEnds = getSteeredEnds({ baseline, computed, focus, operations, shown });
  const areaLessons = getUnnamedAreaLessons({ baseline, computed, operations, shown });
  const weeklyEvents = getWeeklyEventMove({ baseline, computed });
  const today = world.today;
  const nextMock = weeklyEvents ? null : getNextMockMove({ after, before: shown, today });
  const added = getAddedSkillIds(operations);
  const addedTopicsStart = getAddedSkillsStart({ items: after, skillIds: added });
  const focused = focus.areas.length > 0;

  return {
    ...getSeenEffect({ computed, fallback: baseline, shown }),
    ...(addedTopicsStart && { addedTopicsStart }),
    ...(startsBeforeBasics({ items: after, skillIds: added }) && { addedTopicsBeforeBasics: true }),
    ...(focused && { areaStarts: getAreaStarts({ ...focus, after, before: shown }) }),
    ...(areaEnds.length > 0 && { areaEnds }),
    ...(areaLessons.length > 0 && { areaLessons }),
    ...(focused && reviewDate && { reviewFirst: { areas: focus.areas, date: reviewDate } }),
    ...(weeklyEvents && { weeklyEvents }),
    ...(nextMock && { nextMock }),
    endDateAfter: computed.feasibility.endDate ? toIsoDate(computed.feasibility.endDate) : null,
    endDateBefore: baseline.feasibility.endDate ? toIsoDate(baseline.feasibility.endDate) : null,
  };
}

/** `hasNoEffect`. */
function hasNoEffect({
  baseline,
  computed,
  operations,
  requested,
  reviewsAhead,
  world,
}: Planned & {
  operations: readonly PlanOperation[];
  requested: PlanState;
  reviewsAhead: boolean;
  world: SimWorld;
}): boolean {
  const context = toSimContext(world);
  const sameSettings = isDeepStrictEqual(requested.settings, context.state.settings);

  const onlyArranges =
    sameSettings || operations.every((operation) => ARRANGING_OPERATIONS.has(operation.kind));

  const keepsGoal =
    getGoalUpdate({ context, state: computed.state }) === null &&
    isDeepStrictEqual(requested.graph, context.state.graph);

  const steers = operations.every(
    (operation) => operation.kind === "focusAreas" || operation.kind === "reduceAreas",
  );

  const items = { after: computed.built.items, before: baseline.built.items };

  if (!(keepsGoal && steers)) {
    return onlyArranges && keepsGoal && hasSameItems(items);
  }

  const focus = getAskedFocus({ baseline, computed, operations });
  const reduced = getReducedAreas({ computed, operations });
  const refocuses = focus.areas.length > 0 && reviewsAhead && !sameSettings;

  return (
    !refocuses &&
    !(focus.areas.length > 0 && hasFocusGain({ ...focus, ...items })) &&
    !(reduced.areas.length > 0 && hasReduceEffect({ ...reduced, ...items }))
  );
}

/**
 * `planWithAndWithout`'s copy: moving the phase dates starts from the plan that keeps them and
 * moves what Today's proposal said it would (see `planSimPhaseDatesMove`), and a change made only
 * of base choices is planned both bringing back work set aside and leaving it out
 * (`pickSetAsidePlans`).
 */
function planWithAndWithout({
  operations,
  requested,
  world,
}: {
  operations: readonly PlanOperation[];
  requested: PlanState;
  world: SimWorld;
}): Planned & { bringsBackSetAside: boolean } {
  if (operations.some((operation) => operation.kind === "fitPhaseDates")) {
    const baseline = computeSimPlan({ mode: "automatic", world });

    return {
      baseline,
      bringsBackSetAside: false,
      computed: planSimPhaseDatesMove({
        kept: baseline.built,
        mode: "automatic",
        pace: "saved",
        state: requested,
        world,
      }),
    };
  }

  const request = { ...getChangePlanning(operations), world };

  const plan = (planning: typeof request) => ({
    baseline: computeSimPlan(planning),
    computed: computeSimPlan({ ...planning, state: requested }),
  });

  if (!plansSetAsideBothWays({ items: world.plan.items, operations })) {
    return { ...plan(request), bringsBackSetAside: true };
  }

  return pickSetAsidePlans({
    brought: plan(request),
    kept: plan({ ...request, bringBackSetAside: false }),
    shown: world.plan.items,
  });
}

export type SimChangeResult =
  | { error: string; status: "invalid" }
  | (Planned & {
      /** The plan brings work set aside back (`ComputedChange.bringsBackSetAside`). */
      bringsBackSetAside: boolean;
      contradicts: boolean;
      effect: PlanEffect;
      /** The state the operations ask for. */
      requested: PlanState;
      status: "computed";
      unchanged: boolean;
    });

/** `computeChange` (with `applyPlanOperations` first) on the simulator's world. */
export function computeSimChange({
  operations,
  world,
}: {
  operations: readonly PlanOperation[];
  world: SimWorld;
}): SimChangeResult {
  const result = applyPlanOperations({
    goalKind: world.inputs.goal.kind,
    operations,
    state: world.plan.state,
    today: world.today,
  });

  if ("error" in result) {
    return { error: result.error, status: "invalid" };
  }

  const requested = result.state;

  const { baseline, bringsBackSetAside, computed } = planWithAndWithout({
    operations,
    requested,
    world,
  });

  const reviewDate = findReviewAhead({ computed, world });
  const planned = { baseline, computed };
  const reviewsAhead = reviewDate !== null;
  const shown = world.plan.items;

  const contradicts = contradictsSteering({ ...planned, operations, reviewsAhead, shown });

  const unchanged =
    contradicts || hasNoEffect({ ...planned, operations, requested, reviewsAhead, world });

  return {
    ...planned,
    bringsBackSetAside,
    contradicts,
    effect: getEffect({ ...planned, operations, reviewDate, world }),
    requested,
    status: "computed",
    unchanged,
  };
}

/**
 * A change from the editor or the buddy, computed, or null when nothing is saved: invalid
 * operations, a change the buddy would never offer because it does nothing, a focus the editor
 * saves as nothing because it moves nothing, or more or less of areas that would do the opposite
 * (`applySteeringNow`). The editor's choice of how to study bases that moves no lesson keeps only
 * its settings (`saved`, see `computeRequest`).
 */
export function computeSavedSimChange({
  operations,
  via,
  world,
}: {
  operations: readonly PlanOperation[];
  via: "buddy" | "editor";
  world: SimWorld;
}):
  | Extract<SimChangeResult, { status: "computed" }>
  | { settings: PlanState["settings"]; status: "saved" }
  | null {
  const result = computeSimChange({ operations, world });

  if (result.status !== "computed") {
    return null;
  }

  const choicesOnly = operations.every((operation) => operation.kind === "setBaseChoices");

  if (via === "editor" && choicesOnly && result.unchanged) {
    return { settings: result.requested.settings, status: "saved" };
  }

  const focusOnly = operations.every((operation) => operation.kind === "focusAreas");

  const steers = operations.every(
    (operation) => operation.kind === "focusAreas" || operation.kind === "reduceAreas",
  );

  const skipped = via === "buddy" || focusOnly ? result.unchanged : steers && result.contradicts;
  return skipped ? null : result;
}
