import "server-only";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { loadPlacementPlan } from "../_utils/goal-skill-graph";
import { findOwnedGoal, getAnswerTimeZone } from "../_utils/owned-goal";
import { completePlacement } from "./_utils/complete-placement";
import { type PlacementState, loadPlacementWithSummary } from "./_utils/load-placement-state";
import { openTestSitting, saveTestSummary } from "./_utils/test-sitting";
import { type PlacementSittingInput } from "./focus-test-contract";

export type PlacementSittingResult =
  | { placement: PlacementState; status: "ready" }
  | { status: "notFound" }
  | { status: "unauthorized" }
  | { status: "unavailable" };

/**
 * Opens an exam goal's next sitting, the first or a further one, and marks its Focus test started.
 * Asking again while a sitting is open returns that sitting; one with nothing left to ask is
 * finished first. With nothing to ask at all, the state comes back with no sitting.
 * `unavailable`: the goal isn't an exam.
 */
export async function startPlacementSitting({
  goalId,
  input,
}: {
  goalId: string;
  input: PlacementSittingInput;
}): Promise<PlacementSittingResult> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  const { goal, userId } = owned;

  if (goal.kind !== "exam") {
    return { status: "unavailable" };
  }

  const now = new Date();
  const timeZone = getAnswerTimeZone({ goal, timeZone: input.timeZone });
  const today = getDateInTimeZone({ date: now, timeZone });

  const read = async () =>
    loadPlacementWithSummary({
      goalId,
      plan: await loadPlacementPlan(goalId),
      timeZone,
      today,
      userId,
    });

  const open = await read();
  const sitting = open.state.focusTest?.sitting;

  if (sitting && sitting.end === null) {
    return { placement: open.state, status: "ready" };
  }

  if (sitting) {
    await completePlacement({
      goal,
      plan: await loadPlacementPlan(goalId),
      sittingId: open.focusTest?.sittingId ?? null,
      timeZone,
    });
  }

  const { focusTest, state } = sitting ? await read() : open;
  const offer = state.focusTest?.offer;

  if (!focusTest || !offer) {
    return { placement: state, status: "ready" };
  }

  await openTestSitting({ goal, now, offer });

  const opened = await saveTestSummary({
    goalId,
    plan: await loadPlacementPlan(goalId),
    timeZone,
    today,
    userId,
  });

  return { placement: opened.state, status: "ready" };
}
