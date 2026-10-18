import "server-only";
import { getEntitlementViewer } from "./_utils/entitlement-viewer";
import { findReachedUsageLimit } from "./_utils/reached-usage-limit";
import { type AllowanceLimit } from "./contract";

/**
 * The goal limit the learner already reached, judged by the same rules as creating a goal: a
 * guest's one goal, the free plan's one active goal (quick questions aside), or the plan's goals
 * for the day or month. Pages that start goals say it up front, before the learner types or picks
 * anything that couldn't start. Null with room or without a session. Uncached: it decides whether
 * new work starts.
 */
export async function findGoalStartLimit(): Promise<AllowanceLimit | null> {
  const viewer = await getEntitlementViewer();

  if (!viewer) {
    return null;
  }

  return findReachedUsageLimit({ kind: "goal", tier: viewer.tier, userId: viewer.userId });
}
