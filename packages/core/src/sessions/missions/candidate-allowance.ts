import { type UsageKind } from "@zoonk/db";
import { evaluateUsage } from "../../entitlements/_utils/evaluate-usage";
import { type UsageCounts } from "../../entitlements/_utils/usage-counts";
import { type EntitlementTier } from "../../entitlements/contract";
import { getEstimatedCostMicros } from "../../entitlements/limits";

/** A mission must fit the same caps as the entry point, including every answer in a round. */
export function hasMissionAllowance({
  counts,
  kind,
  now,
  seconds = 0,
  tier,
  uses = 1,
}: {
  counts: UsageCounts | null;
  kind: UsageKind;
  now: Date;
  seconds?: number;
  tier: EntitlementTier;
  uses?: number;
}): boolean {
  if (!counts || uses <= 0) {
    return false;
  }

  const previousUses = uses - 1;

  return (
    evaluateUsage({
      costMicros: uses * getEstimatedCostMicros({ generated: false, kind, seconds }),
      counts: {
        ...counts,
        day: counts.day + previousUses,
        month: counts.month + previousUses,
        total: counts.total + previousUses,
      },
      generated: false,
      kind,
      now,
      tier,
    }).status !== "limitReached"
  );
}
