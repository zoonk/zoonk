import "server-only";
import { type GoalKind } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { findOwnedGoal } from "../learner/_utils/owned-goal";

export type GoalGenerationAccess =
  | { goal: { id: string; kind: GoalKind }; status: "ready" }
  | { status: "notFound" }
  | { status: "unauthorized" };

/**
 * Whether the signed-in learner may (re)start what one of their goals needs written: its
 * curriculum, or its explanation for an explain question. The runs themselves are idempotent, so
 * starting again after a failure only redoes what is missing. Another learner's goal is not found.
 */
export async function getGoalGenerationAccess({
  goalId,
}: {
  goalId: string;
}): Promise<GoalGenerationAccess> {
  if (!isUuid(goalId)) {
    return { status: "notFound" };
  }

  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  return { goal: { id: owned.goal.id, kind: owned.goal.kind }, status: "ready" };
}
