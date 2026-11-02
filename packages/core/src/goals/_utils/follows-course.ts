import { type Goal } from "@zoonk/db";

/** A course's page offers to continue the goal that follows it instead of starting it again. */
export function followsCourse(goal: Pick<Goal, "kind" | "status">): boolean {
  return goal.status === "active" && goal.kind !== "explain";
}
