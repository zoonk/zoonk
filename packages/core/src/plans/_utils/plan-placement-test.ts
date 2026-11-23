import { availableLevelTestOut } from "../../language/level-test/_utils/level-test-out-items";
import { withLevelTestChange } from "../../language/level-test/_utils/level-test-result-change";
import { readLevelTestSummary } from "../../language/level-test/read-level-test-summary";
import { loadPlacementPlan } from "../../learner/_utils/goal-skill-graph";
import { loadPlacementState } from "../../learner/placement/_utils/load-placement-state";
import {
  type PlacementAttempt,
  getPlacementEstimate,
  isTopicAhead,
  placementAttemptView,
  readPendingTopicWalkAssessmentId,
  readPlacementAttempt,
} from "../../learner/placement/_utils/placement-attempt-record";
import { type PlanView } from "../plan-view-contract";
import { type PlanContext } from "./plan-context";

async function readAttemptView(
  { goal, timeZone, today }: PlanContext,
  attempt: PlacementAttempt | null,
) {
  if (attempt?.length !== "wholeCourse") {
    return attempt && placementAttemptView(attempt);
  }

  const placement = await loadPlacementState({
    goalId: goal.id,
    plan: await loadPlacementPlan(goal.id),
    timeZone,
    today,
    userId: goal.userId,
  });

  return placement.attempt ?? null;
}

export async function readPlanPlacementTest(
  context: PlanContext,
  now: Date,
): Promise<PlanView["placementTest"]> {
  const { goal } = context;

  if (goal.kind !== "learn" && goal.kind !== "language") {
    return null;
  }

  const placement = readPlacementAttempt(goal);
  const { attempt, result } = placement;

  const attemptView = await readAttemptView(context, attempt);

  const lessonsBySkill = Map.groupBy(context.items, (item) => item.skillId);

  const ahead = context.state.graph.skills.filter((skill) =>
    isTopicAhead(lessonsBySkill.get(skill.skillId)),
  );

  const estimatedMinutes =
    attemptView?.estimatedMinutes ??
    getPlacementEstimate({ length: "wholeCourse", topics: ahead.length });

  if (goal.kind === "language") {
    const summary = readLevelTestSummary(goal);
    const waitingForTopicWalk = readPendingTopicWalkAssessmentId(goal, placement) !== null;
    const continuing = attemptView || summary.attempt || waitingForTopicWalk;
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
      attempt: attemptView,
      estimatedMinutes,
      kind: "language",
      nextTestOutLevel,
      result: levelResult,
      state: continuing ? "continue" : idleState,
    };
  }

  const idleState = result ? "result" : "start";

  return {
    attempt: attemptView,
    estimatedMinutes,
    kind: "learn",
    result,
    state: attemptView ? "continue" : idleState,
  };
}
