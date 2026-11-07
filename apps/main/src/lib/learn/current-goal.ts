import "server-only";
import { type GoalView } from "@zoonk/core/goals/contract";
import { listCurrentUserGoals } from "@zoonk/core/goals/list-current-user";

/** The requested goal when it's one of the learner's own, otherwise the active one. */
export async function getCurrentGoal(requestedGoalId?: string): Promise<GoalView | null> {
  const list = await listCurrentUserGoals();
  const goals = list?.goals ?? [];

  return (
    goals.find((goal) => goal.id === requestedGoalId) ?? goals.find((goal) => goal.isActive) ?? null
  );
}
