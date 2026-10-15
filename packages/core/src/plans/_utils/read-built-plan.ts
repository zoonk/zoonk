import "server-only";
import { cacheTag } from "next/cache";
import { getGoalsCacheTag, getLearnerModelCacheTag } from "../../cache/tags";
import { type BuildPlanInput, buildPlan } from "../planner/build-plan";

/** Extra freshness boundaries for Today's read; complete freshly loaded producer inputs remain keyed. */
export type TodayBuildScope = {
  entitlement: "free" | "plus";
  inputVersion: number;
  planId: string;
  planVersion: number;
  timeZone: string;
};

/** Shares a pure build by its complete fresh input and owned actor, without caching lazy advice. */
export async function readBuiltPlan({
  input,
  userId,
}: {
  input: BuildPlanInput;
  /** The entire argument is serialized by use-cache, including this scope. */
  scope?: TodayBuildScope;
  userId: string;
}) {
  "use cache";

  cacheTag(getGoalsCacheTag(userId), getLearnerModelCacheTag(userId));

  return buildPlan(input);
}
