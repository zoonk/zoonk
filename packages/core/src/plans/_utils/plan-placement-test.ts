import { withLevelTestChange } from "../../language/level-test/_utils/level-test-result-change";
import { readLevelTestSummary } from "../../language/level-test/read-level-test-summary";
import {
  getPlacementEstimate,
  placementAttemptView,
  readPendingTopicWalkAssessmentId,
  readPlacementAttempt,
} from "../../learner/placement/_utils/placement-attempt-record";
import { type PlanView } from "../plan-view-contract";
import { type PlanContext } from "./plan-context";

export async function readPlanPlacementTest(
  context: PlanContext,
): Promise<PlanView["placementTest"]> {
  const { goal } = context;

  if (goal.kind !== "learn" && goal.kind !== "language") {
    return null;
  }

  const placement = readPlacementAttempt(goal);
  const { attempt, result } = placement;

  const settled = new Set(
    context.items.flatMap((item) =>
      item.status === "done" || item.status === "testedOut" ? (item.skillId ?? []) : [],
    ),
  );

  const ahead = context.state.graph.skills.filter((skill) => !settled.has(skill.skillId));

  const estimatedMinutes =
    attempt?.estimatedMinutes ??
    getPlacementEstimate({ length: "wholeCourse", topics: ahead.length });

  const attemptView = attempt ? placementAttemptView(attempt) : null;

  if (goal.kind === "language") {
    const summary = readLevelTestSummary(goal);
    const waitingForTopicWalk = readPendingTopicWalkAssessmentId(goal, placement) !== null;
    const continuing = attempt || summary.attempt || waitingForTopicWalk;
    const idleState = summary.result ? "result" : "start";

    return {
      attempt: attemptView,
      estimatedMinutes,
      kind: "language",
      nextTestOutLevel: summary.nextTestOutLevel,
      result: summary.result ? await withLevelTestChange(goal.id, summary.result) : null,
      state: continuing ? "continue" : idleState,
    };
  }

  const idleState = result ? "result" : "start";

  return {
    attempt: attemptView,
    estimatedMinutes,
    kind: "learn",
    result,
    state: attempt ? "continue" : idleState,
  };
}
