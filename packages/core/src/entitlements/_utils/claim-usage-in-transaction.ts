import { type TransactionClient, type UsageKind } from "@zoonk/db";
import { getEstimatedCostMicros } from "../limits";
import { type UsageClaim, holdCallTimeAgain } from "./call-time";
import { type EntitlementViewer } from "./entitlement-viewer";
import { evaluateUsage, getCallHold, getCallTimeLeft } from "./evaluate-usage";
import { claimGuestSpend } from "./guest-spend-budget";
import { countUsage } from "./usage-counts";

/**
 * Shares the entitlement claim with atomic live-call reservation, never a separate commit. Says
 * whether it wrote, so a retried target or a refusal can leave the learner's revision alone.
 */
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
    return seconds === undefined
      ? { decision: { status: "allowed" }, recorded: false }
      : holdCallTimeAgain({ now, record: existing, seconds, transaction, viewer });
  }

  const counts = await countUsage({ client: transaction, kind, now, userId: viewer.userId });

  const hold =
    seconds === undefined
      ? null
      : getCallHold({
          left: getCallTimeLeft({
            kind,
            tier: viewer.tier,
            usedThisMonth: counts.secondsThisMonth,
            usedToday: counts.secondsToday,
          }),
          seconds,
        });

  const held = hold?.heldSeconds ?? 0;
  const costMicros = getEstimatedCostMicros({ generated, kind, seconds: held });
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
      seconds: held,
      targetId,
      userId: viewer.userId,
    },
  });

  if (!hold) {
    return { decision, recorded: true };
  }

  return {
    decision: hold.shortenedBy
      ? { ...decision, heldSeconds: held, shortenedBy: hold.shortenedBy }
      : { ...decision, heldSeconds: held },
    recorded: true,
  };
}
