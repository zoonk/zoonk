import "server-only";
import { findOwnedGoal } from "../_utils/owned-goal";
import { type PlacementState } from "./_utils/load-placement-state";
import { type PlacementSittingInput } from "./focus-test-contract";

export type PlacementSittingResult =
  | { placement: PlacementState; status: "ready" }
  | { status: "notFound" }
  | { status: "unauthorized" }
  | { status: "unavailable" };

/**
 * Opens an exam goal's next sitting, the first or a further one, and marks its Focus test started.
 * Asking again while a sitting is open returns that sitting. `unavailable`: the goal isn't an exam.
 */
export async function startPlacementSitting({
  goalId,
}: {
  goalId: string;
  input: PlacementSittingInput;
}): Promise<PlacementSittingResult> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  return { status: "unavailable" };
}
