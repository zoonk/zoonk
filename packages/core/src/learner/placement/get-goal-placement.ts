import "server-only";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { loadPlacementPlan } from "../_utils/goal-skill-graph";
import { findOwnedGoal, getAnswerTimeZone } from "../_utils/owned-goal";
import { type PlacementState, loadPlacementState } from "./_utils/load-placement-state";
import { getOwnLevel } from "./placement-contract";
import { type OwnLevel } from "./placement-steps";

export type GoalPlacementResult =
  | { placement: PlacementState; status: "ready" }
  | { status: "notFound" }
  | { status: "unauthorized" };

/**
 * Returns where placement stands for one of the learner's goals and the next question to ask.
 * The learner's own level sets where the first question comes from; once the day's few minutes
 * are used, there's no next question until the first week's sessions ask the rest. Uncached: it is the step of
 * a flow, and every answer changes it.
 */
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
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  const placement = await loadPlacementState({
    goalId,
    ownLevel: getOwnLevel({ goal: owned.goal, level }),
    plan: await loadPlacementPlan(goalId),
    today: getDateInTimeZone({
      date: new Date(),
      timeZone: getAnswerTimeZone({ goal: owned.goal, timeZone }),
    }),
    userId: owned.userId,
  });

  return { placement, status: "ready" };
}
