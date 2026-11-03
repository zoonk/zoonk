import { type TransactionClient, type UsageKind } from "@zoonk/db";
import { type UsageDecision } from "../contract";
import { getEstimatedCostMicros } from "../limits";
import { type EntitlementViewer } from "./entitlement-viewer";
import { evaluateUsage } from "./evaluate-usage";
import { claimGuestSpend } from "./guest-spend-budget";
import { countUsage } from "./usage-counts";

type UsageClaim = { decision: UsageDecision; recorded: boolean };

export async function claimUsageInTransaction({
  generated,
  kind,
  now,
  seconds,
  targetId,
  transaction,
  viewer,
}: {
  generated: boolean;
  kind: UsageKind;
  now: Date;
  seconds?: number;
  targetId: string;
  transaction: TransactionClient;
  viewer: EntitlementViewer;
}): Promise<UsageClaim> {
  const existing = await transaction.usageRecord.findUnique({
    where: { userUsageTarget: { kind, targetId, userId: viewer.userId } },
  });

  if (existing) {
    return { decision: { status: "allowed" }, recorded: false };
  }

  const counts = await countUsage({ client: transaction, kind, now, userId: viewer.userId });

  const costMicros = getEstimatedCostMicros({ generated, kind, seconds });
  const decision = evaluateUsage({ costMicros, counts, generated, kind, now, tier: viewer.tier });

  if (decision.status !== "allowed") {
    return { decision, recorded: false };
  }

  const takesGuestBudget = viewer.isGuest && costMicros > 0;

  if (takesGuestBudget && !(await claimGuestSpend({ costMicros, now, transaction }))) {
    return { decision: { status: "signUpRequired" }, recorded: false };
  }

  await transaction.usageRecord.create({
    data: {
      costMicros,
      createdAt: now,
      generated,
      kind,
      seconds: seconds ?? 0,
      targetId,
      userId: viewer.userId,
    },
  });

  return { decision, recorded: true };
}
