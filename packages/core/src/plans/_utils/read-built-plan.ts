import "server-only";
import { cacheTag } from "next/cache";
import { getGoalsCacheTag, getLearnerModelCacheTag } from "../../cache/tags";
import { type BuildPlanInput, buildPlan } from "../planner/build-plan";

/** Shares a pure build by its complete fresh input and owned actor, without caching lazy advice. */
export async function readBuiltPlan({ input, userId }: { input: BuildPlanInput; userId: string }) {
  "use cache";

  cacheTag(getGoalsCacheTag(userId), getLearnerModelCacheTag(userId));

  return buildPlan(input);
}
