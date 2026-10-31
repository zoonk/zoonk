import "server-only";
import { findOwnedGoal } from "../../learner/_utils/owned-goal";
import { type FocusTest, loadFocusTest } from "./_utils/load-focus-test";

export type FocusTestResult =
  | { focusTest: FocusTest; status: "ready" }
  | { status: "notFound" }
  | { status: "unauthorized" }
  | { status: "unavailable" };

/** Stores nothing until the learner submits the answers. */
export async function getFocusTest({ goalId }: { goalId: string }): Promise<FocusTestResult> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  const focusTest = await loadFocusTest({ goal: owned.goal, userId: owned.userId });
  return focusTest ? { focusTest, status: "ready" } : { status: "unavailable" };
}
