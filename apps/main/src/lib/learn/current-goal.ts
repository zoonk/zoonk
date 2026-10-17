import "server-only";
import { type GoalView } from "@zoonk/core/goals/contract";
import { listCurrentUserGoals } from "@zoonk/core/goals/list-current-user";

/**
 * The goal the tabs show, as core picks it for every tab: the one picked in the goal switcher, or
 * the learner's first active goal when none was picked yet. Null without an active goal (or
 * without a session).
 */
export async function getCurrentGoal(): Promise<GoalView | null> {
  const list = await listCurrentUserGoals();
  return list?.goals.find((goal) => goal.isActive) ?? null;
}
