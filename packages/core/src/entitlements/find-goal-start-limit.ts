import "server-only";
import { getEntitlementViewer } from "./_utils/entitlement-viewer";
import { findReachedUsageLimit } from "./_utils/reached-usage-limit";
import { type AllowanceLimit } from "./contract";

/** Fresh check; returns null with room or without a session. */
export async function findGoalStartLimit(): Promise<AllowanceLimit | null> {
  const viewer = await getEntitlementViewer();

  if (!viewer) {
    return null;
  }

  return findReachedUsageLimit({ kind: "goal", tier: viewer.tier, userId: viewer.userId });
}
