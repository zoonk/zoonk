import "server-only";
import { cacheTag } from "next/cache";
import { getUserSubscriptionCacheTag } from "../cache/tags";
import { getRequestInstant } from "../learner/facts/request-instant";
import { readUsageTotals } from "../learner/facts/usage-totals";
import { toAllowance } from "./_utils/allowance-view";
import { readEntitlementViewer } from "./_utils/entitlement-viewer";
import { type Allowance } from "./contract";

/** Returns null without a session. */
export async function getAllowance(): Promise<Allowance | null> {
  "use cache: private";

  const viewer = await readEntitlementViewer();

  if (!viewer) {
    return null;
  }

  cacheTag(getUserSubscriptionCacheTag(viewer.userId));

  const [now, totals] = await Promise.all([getRequestInstant(), readUsageTotals(viewer.userId)]);

  return toAllowance({ now, tier: viewer.tier, totals });
}
