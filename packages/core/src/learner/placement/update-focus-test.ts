import "server-only";
import { findOwnedGoal } from "../_utils/owned-goal";
import { type FocusTestControlsInput, type FocusTestSummary } from "./focus-test-contract";

export type FocusTestControlsResult =
  | { focusTest: FocusTestSummary; status: "ready" }
  | { status: "notFound" }
  | { status: "unauthorized" }
  | { status: "unavailable" };

/**
 * The learner's own switches on an exam goal's Focus test: its questions inside sessions and
 * Today's suggestion. `unavailable`: the goal isn't an exam.
 */
export async function updateFocusTest({
  goalId,
}: {
  goalId: string;
  input: FocusTestControlsInput;
}): Promise<FocusTestControlsResult> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  return { status: "unavailable" };
}
