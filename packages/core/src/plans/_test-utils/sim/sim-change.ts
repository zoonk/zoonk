import { isDeepStrictEqual } from "node:util";
import { getGoalUpdate, hasSameItems } from "../../_utils/plan-unchanged";
import { type ComputedPlan } from "../../_utils/replan";
import { pickSetAsidePlans, plansSetAsideBothWays } from "../../_utils/set-aside-plans";
import {
  contradictsSteering,
  getAskedFocus,
  getChangePlanning,
  getReducedAreas,
} from "../../_utils/steered-areas";
import { type PlanOperation } from "../../plan-contract";
import { hasFocusGain, hasReduceEffect } from "../../planner/focus-gain";
import { fromIsoDate, toIsoDate } from "../../planner/plan-calendar";
import { applyPlanOperations } from "../../planner/plan-operations";
import { type PlanState } from "../../planner/plan-state";
import { isShortExam } from "../../planner/short-exam-plan";
import { computeSimPlan } from "./sim-planner";
import { type SimWorld, toSimContext } from "./sim-world";

/**
 * `computeChange`'s copy (see `sim-planner.ts`): the change planned next to the plan re-planned
 * the same way without it, and whether it does anything at all.
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
 * `planWithAndWithout`'s copy: a change made only of base choices is planned both bringing back
 * work set aside and leaving it out (`pickSetAsidePlans`).
 */
function planWithAndWithout({
  operations,
  requested,
  world,
}: {
  operations: readonly PlanOperation[];
  requested: PlanState;
  world: SimWorld;
}): Planned {
  const request = { ...getChangePlanning(operations), world };

  const plan = (planning: typeof request) => ({
    baseline: computeSimPlan(planning),
    computed: computeSimPlan({ ...planning, state: requested }),
  });

  if (!plansSetAsideBothWays({ items: world.plan.items, operations })) {
    return plan(request);
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
      contradicts: boolean;
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

  const { baseline, computed } = planWithAndWithout({ operations, requested, world });

  const reviewDate = findReviewAhead({ computed, world });
  const planned = { baseline, computed };
  const reviewsAhead = reviewDate !== null;
  const shown = world.plan.items;

  const contradicts = contradictsSteering({ ...planned, operations, reviewsAhead, shown });

  const unchanged =
    contradicts || hasNoEffect({ ...planned, operations, requested, reviewsAhead, world });

  return { ...planned, contradicts, requested, status: "computed", unchanged };
}

/**
 * The editor's choice of how to study bases, computed, or null for invalid operations. One that
 * moves no lesson keeps only its settings (`saved`, see `computeRequest`).
 */
export function computeSavedSimChange({
  operations,
  world,
}: {
  operations: readonly PlanOperation[];
  world: SimWorld;
}):
  | Extract<SimChangeResult, { status: "computed" }>
  | { settings: PlanState["settings"]; status: "saved" }
  | null {
  const result = computeSimChange({ operations, world });

  if (result.status !== "computed") {
    return null;
  }

  return result.unchanged ? { settings: result.requested.settings, status: "saved" } : result;
}
