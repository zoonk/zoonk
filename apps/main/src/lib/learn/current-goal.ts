import "server-only";
import { type GoalView } from "@zoonk/core/goals/contract";
import { listCurrentUserGoals } from "@zoonk/core/goals/list-current-user";

export async function getCurrentGoal(): Promise<GoalView | null> {
  const list = await listCurrentUserGoals();
  return list?.goals.find((goal) => goal.isActive) ?? null;
}
