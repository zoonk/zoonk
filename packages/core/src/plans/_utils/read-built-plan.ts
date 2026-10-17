import "server-only";
import { type BuildPlanInput, buildPlan } from "../planner/build-plan";

/** Extra freshness boundaries for Today's read; complete freshly loaded producer inputs remain keyed. */
export type TodayBuildScope = {
  entitlement: "free" | "plus";
  inputVersion: number;
  planId: string;
  planVersion: number;
  timeZone: string;
};

/**
 * Shares a pure build by its complete fresh input and owned actor, without caching lazy advice. The
 * key is everything the build reads, so a write never makes it stale: one that changes the plan's
 * inputs reads under another key, and one that doesn't keeps it.
 */
export async function readBuiltPlan({
  input,
}: {
  input: BuildPlanInput;
  /** The entire argument is serialized by use-cache, including this scope and owner. */
  scope?: TodayBuildScope;
  userId: string;
}) {
  "use cache";

  return buildPlan(input);
}
