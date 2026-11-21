import {
  getPlacementEstimate,
  placementAttemptView,
  readPlacementAttempt,
} from "../../learner/placement/_utils/placement-attempt-record";
import { type PlanView } from "../plan-view-contract";
import { type PlanContext } from "./plan-context";

export function readPlanPlacementTest(context: PlanContext): PlanView["placementTest"] {
  if (context.goal.kind !== "learn") {
    return null;
  }

  const { attempt, result } = readPlacementAttempt(context.goal);

  const settled = new Set(
    context.items.flatMap((item) =>
      item.status === "done" || item.status === "testedOut" ? (item.skillId ?? []) : [],
    ),
  );

  const ahead = context.state.graph.skills.filter((skill) => !settled.has(skill.skillId));

  const whenIdle = result ? "result" : "start";

  return {
    attempt: attempt ? placementAttemptView(attempt) : null,
    estimatedMinutes:
      attempt?.estimatedMinutes ??
      getPlacementEstimate({ length: "wholeCourse", topics: ahead.length }),
    kind: "learn",
    result,
    state: attempt ? "continue" : whenIdle,
  };
}
