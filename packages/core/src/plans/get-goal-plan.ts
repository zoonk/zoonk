import "server-only";
import { isValidTimeZone } from "@zoonk/utils/time-zone";
import { cacheTag } from "next/cache";
import { getGoalsCacheTag, getLearnerModelCacheTag } from "../cache/tags";
import { findOwnedGoal } from "../learner/_utils/owned-goal";
import { getRequestProgressDateContext } from "../progress/get-request-date-context";
import { loadPlanContext } from "./_utils/plan-context";
import { buildPlanView } from "./_utils/plan-view";
import { type PlanView } from "./plan-view-contract";

export type GoalPlanResult =
  | { plan: PlanView; status: "ready" }
  | { status: "notFound" }
  | { status: "unauthorized" };

/**
 * One of the learner's plans at every zoom level. The learner's day comes from the goal's timezone,
 * then the request's.
 */
export async function getGoalPlan(goalId: string): Promise<GoalPlanResult> {
  "use cache: private";

  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  cacheTag(getGoalsCacheTag(owned.userId), getLearnerModelCacheTag(owned.userId));

  const { currentInstant, timeZone } = await getRequestProgressDateContext();
  const goalZone = owned.goal.timezone;

  const context = await loadPlanContext({
    goal: owned.goal,
    now: currentInstant,
    timeZone: goalZone && isValidTimeZone(goalZone) ? goalZone : timeZone,
  });

  if (!context) {
    return { status: "notFound" };
  }

  return { plan: await buildPlanView({ context, now: currentInstant }), status: "ready" };
}
