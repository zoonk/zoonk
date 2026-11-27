import "server-only";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerTimeZone } from "../_utils/owned-goal";
import { getRequestInstant } from "../facts/request-instant";
import { getOwnedGoal } from "../get-owned-goal";
import { type PlacementState, loadPlacementState } from "./_utils/load-placement-state";
import { getOwnLevel } from "./placement-contract";
import { type OwnLevel } from "./placement-steps";

export type GoalPlacementResult =
  | { placement: PlacementState; status: "ready" }
  | { status: "notFound" }
  | { status: "unauthorized" };

/** Uncached flow read; after today's budget is used, first-week sessions ask the remaining questions. */
export async function getGoalPlacement({
  goalId,
  level,
  timeZone,
}: {
  goalId: string;
  level?: OwnLevel | null;
  /** The learner's timezone, so the day's few minutes of placement follow their day. */
  timeZone?: string;
}): Promise<GoalPlacementResult> {
  const owned = await getOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  const now = await getRequestInstant();

  const placement = await loadPlacementState({
    goalId,
    ownLevel: getOwnLevel({ goal: owned.goal, level }),
    timeZone,
    today: getDateInTimeZone({
      date: now,
      timeZone: getAnswerTimeZone({ goal: owned.goal, timeZone }),
    }),
    userId: owned.userId,
  });

  return { placement, status: "ready" };
}
