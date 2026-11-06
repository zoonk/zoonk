import "server-only";
import { readEntitlementViewer } from "./_utils/entitlement-viewer";
import { findReachedUsageLimit } from "./_utils/reached-usage-limit";
import { type AllowanceLimit } from "./contract";

/** Display read; returns null with room or without a session. Creating a goal checks again. */
export async function findGoalStartLimit(): Promise<AllowanceLimit | null> {
  const viewer = await readEntitlementViewer();

  if (!viewer) {
    return null;
  }

  return findReachedUsageLimit({ kind: "goal", tier: viewer.tier, userId: viewer.userId });
}
