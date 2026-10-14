import { type TransactionClient } from "@zoonk/db";
import { type UsageDecision } from "../contract";
import { getEstimatedCostMicros } from "../limits";
import { claimUsageInTransaction } from "./claim-usage-in-transaction";
import { type EntitlementViewer } from "./entitlement-viewer";
import { evaluateUsage, getCallHold, getCallTimeLeft } from "./evaluate-usage";
import { countUsage } from "./usage-counts";
import { getUsagePeriodStarts } from "./usage-periods";

/** Closed connections already settled their practice seconds; reconnects add a new hold. */
export async function claimLiveCallTime({
  conversationId,
  now,
  seconds,
  transaction,
  viewer,
}: {
  conversationId: string;
  now: Date;
  seconds: number;
  transaction: TransactionClient;
  viewer: EntitlementViewer;
}): Promise<UsageDecision & { priorUsageSeconds?: number }> {
  const record = await transaction.usageRecord.findUnique({
    where: {
      userUsageTarget: { kind: "conversation", targetId: conversationId, userId: viewer.userId },
    },
  });

  if (!record) {
    return claimUsageInTransaction({
      generated: false,
      kind: "conversation",
      now,
      seconds,
      targetId: conversationId,
      transaction,
      viewer,
    });
  }

  if (record.createdAt < getUsagePeriodStarts(now).day) {
    return { heldSeconds: 0, status: "allowed" };
  }

  const counts = await countUsage({
    client: transaction,
    kind: "conversation",
    now,
    userId: viewer.userId,
  });

  const decision = evaluateUsage({
    costMicros: getEstimatedCostMicros({ generated: false, kind: "conversation", seconds }),
    counts,
    generated: false,
    kind: "conversation",
    now,
    tier: viewer.tier,
  });

  if (decision.status !== "allowed") {
    return decision;
  }

  const hold = getCallHold({
    left: getCallTimeLeft({
      kind: "conversation",
      tier: viewer.tier,
      usedThisMonth: counts.secondsThisMonth,
      usedToday: counts.secondsToday,
    }),
    seconds,
  });

  await transaction.usageRecord.update({
    data: { seconds: record.seconds + hold.heldSeconds },
    where: { id: record.id },
  });

  return {
    heldSeconds: hold.heldSeconds,
    priorUsageSeconds: record.seconds,
    ...(hold.shortenedBy ? { shortenedBy: hold.shortenedBy } : {}),
    status: "allowed",
  };
}
