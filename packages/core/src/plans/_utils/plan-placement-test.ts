import { availableLevelTestOut } from "../../language/level-test/_utils/level-test-out-items";
import { withLevelTestChange } from "../../language/level-test/_utils/level-test-result-change";
import { LANGUAGE_LEVEL_TEST_OFFER } from "../../language/level-test/level-test-contract";
import { readLevelTestSummary } from "../../language/level-test/read-level-test-summary";
import { loadPlacementPlan } from "../../learner/_utils/goal-skill-graph";
import { readCoursePlacementOffer } from "../../learner/placement/_utils/course-placement-offer";
import { loadPlacementState } from "../../learner/placement/_utils/load-placement-state";
import {
  type PlacementAttempt,
  type PlacementRecord,
  readPlacementAttempt,
} from "../../learner/placement/_utils/placement-attempt-record";
import { readPlacementResult } from "../../learner/placement/_utils/placement-result";
import { type PlanView } from "../plan-view-contract";
import { type PlanContext } from "./plan-context";

async function readAttemptPlacement(
  { goal, timeZone, today }: PlanContext,
  attempt: PlacementAttempt | null,
) {
  if (!attempt) {
    return null;
  }

  return loadPlacementState({
    goalId: goal.id,
    plan: await loadPlacementPlan(goal.id),
    timeZone,
    today,
    userId: goal.userId,
  });
}

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
  attemptPlacement,
  context: { goal },
  placement,
}: {
  attemptPlacement: Awaited<ReturnType<typeof readAttemptPlacement>>;
  context: PlanContext;
  placement: PlacementRecord;
}): Promise<PlanView["placementTest"]> {
  const attemptView = attemptPlacement?.attempt ?? null;
  const course = attemptView ? null : await readCoursePlacementOffer({ goal });
  const offer = course?.offer ?? null;

  const result = attemptPlacement
    ? (attemptPlacement.result ?? null)
    : await readPlacementResult({ goalId: goal.id, placement });

  const idleState = result ? "result" : "start";

  return {
    attempt: attemptView,
    estimatedMinutes:
      attemptView?.totalEstimatedMinutes ??
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
  const attemptPlacement = await readAttemptPlacement(context, placement.attempt);
  return readCourseRow({ attemptPlacement, context, placement });
}
