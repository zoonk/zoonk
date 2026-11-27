import { availableLevelTestOut } from "../../language/level-test/_utils/level-test-out-items";
import { withLevelTestChange } from "../../language/level-test/_utils/level-test-result-change";
import { LANGUAGE_LEVEL_TEST_OFFER } from "../../language/level-test/level-test-contract";
import { readLevelTestSummary } from "../../language/level-test/read-level-test-summary";
import { type GoalPlan, loadCoursePlacementPlan } from "../../learner/_utils/goal-skill-graph";
import { loadPlacementState } from "../../learner/placement/_utils/load-placement-state";
import {
  type PlacementRecord,
  getCourseOffer,
  getTopicsAhead,
  readPlacementAttempt,
} from "../../learner/placement/_utils/placement-attempt-record";
import { readPlacementResult } from "../../learner/placement/_utils/placement-result";
import { type PlanView } from "../plan-view-contract";
import { type PlanContext } from "./plan-context";

async function readLanguageRow(
  context: PlanContext,
  now: Date,
): Promise<PlanView["placementTest"]> {
  const { goal } = context;
  const summary = readLevelTestSummary(goal);
  const idleState = summary.result ? "result" : "start";

  const [nextTestOutLevel, levelResult] = await Promise.all([
    summary.openTestOutLevel ??
      availableLevelTestOut({
        goalId: goal.id,
        levels: summary.eligibleTestOutLevels,
        now,
        timeZone: context.timeZone,
        userId: goal.userId,
      }),
    summary.result ? withLevelTestChange(goal.id, summary.result) : null,
  ]);

  return {
    ...(summary.attempt?.answered !== undefined && {
      answered: summary.attempt.answered,
      total: LANGUAGE_LEVEL_TEST_OFFER.total,
    }),
    attempt: null,
    estimatedMinutes: LANGUAGE_LEVEL_TEST_OFFER.estimatedMinutes,
    kind: "language",
    nextTestOutLevel,
    result: levelResult,
    state: summary.attempt ? "continue" : idleState,
  };
}

async function readCourseRow({
  context: { goal, timeZone, today },
  placement,
  plan,
}: {
  context: PlanContext;
  placement: PlacementRecord;
  plan: GoalPlan;
}): Promise<PlanView["placementTest"]> {
  const attemptPlacement = placement.attempt
    ? await loadPlacementState({ goalId: goal.id, plan, timeZone, today, userId: goal.userId })
    : null;

  const attemptView = attemptPlacement?.attempt ?? null;
  const offer = attemptView ? null : getCourseOffer(getTopicsAhead(plan).length);

  const result = attemptPlacement
    ? (attemptPlacement.result ?? null)
    : await readPlacementResult({ goalId: goal.id, placement });

  const idleState = result ? "result" : "start";

  return {
    attempt: attemptView,
    estimatedMinutes:
      attemptView?.remainingEstimatedMinutes ??
      offer?.wholeCourse?.estimatedMinutes ??
      offer?.estimatedMinutes ??
      0,
    kind: "learn",
    offer,
    result,
    state:
      attemptView && (!attemptView.partComplete || attemptView.partsLeft > 0)
        ? "continue"
        : idleState,
  };
}

export async function readPlanPlacementTest(
  context: PlanContext,
  now: Date,
): Promise<PlanView["placementTest"]> {
  const { goal } = context;

  if (goal.kind !== "learn" && goal.kind !== "language") {
    return null;
  }

  if (goal.kind === "language") {
    return readLanguageRow(context, now);
  }

  const placement = readPlacementAttempt(goal);

  const plan = await loadCoursePlacementPlan(goal.id, {
    source: {
      graph: context.state.graph,
      items: context.items,
      phases: context.phases,
      settings: context.state.settings,
    },
  });

  return readCourseRow({ context, placement, plan });
}
