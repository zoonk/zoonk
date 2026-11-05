import { type TransactionClient } from "@zoonk/db";
import { lockLearner } from "@zoonk/db/learner-writes";
import { getActiveSubscriptionQuery } from "./active-subscription";

/**
 * Plus makes every certificate the learner earned one they can show, dated when they earned it,
 * and an issued one stays issued after Plus ends. Every write that can give Plus calls this in its
 * transaction, and every award does after writing rows, both under the learner's lock: whichever
 * commits second sees the other.
 *
 * `check` reads the subscription in `tx`. A verified grant, such as a Stripe event, is trusted
 * instead of our copy, which a cancellation or refund may have ended since; it covers what was
 * earned by `grantedAt`, so a grant delivered again after Plus ended doesn't issue what was earned
 * without it. Guests are never Plus.
 */
export async function issueEarnedCertificates(
  tx: TransactionClient,
  { now, plus, userId }: { now: Date; plus: "check" | { grantedAt: Date }; userId: string },
): Promise<number> {
  const user = await tx.user.findUnique({ select: { isAnonymous: true }, where: { id: userId } });

  if (!user || user.isAnonymous) {
    return 0;
  }

  await lockLearner(tx, { userId });

  if (plus === "check") {
    const active = await tx.subscription.findFirst({
      select: { id: true },
      ...getActiveSubscriptionQuery({ now, userId }),
    });

    if (!active) {
      return 0;
    }
  }

  const issued = await tx.certificate.updateMany({
    data: { issuedAt: now },
    where: {
      issuedAt: null,
      userId,
      ...(plus !== "check" && { createdAt: { lte: plus.grantedAt } }),
    },
  });

  return issued.count;
}
