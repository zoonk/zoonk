import "server-only";
import { findOwnedGoal } from "../../learner/_utils/owned-goal";
import { type FocusTest, loadFocusTest } from "./_utils/load-focus-test";

export type FocusTestResult =
  | { focusTest: FocusTest; status: "ready" }
  | { status: "notFound" }
  | { status: "unauthorized" }
  | { status: "unavailable" };

/**
 * The focus test for one of the learner's goals: a few questions on each of the plan's areas
 * worth most, in the exam's format, so their answers choose where the plan's depth goes. Nothing
 * is stored until the learner submits the answers. `unavailable` when the plan has fewer than two
 * areas to choose between.
 */
export async function getFocusTest({ goalId }: { goalId: string }): Promise<FocusTestResult> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  const focusTest = await loadFocusTest({ goal: owned.goal, userId: owned.userId });
  return focusTest ? { focusTest, status: "ready" } : { status: "unavailable" };
}
