import { type TransactionClient } from "@zoonk/db";
import { lockLearner } from "@zoonk/db/learner-writes";
import { getActiveSubscriptionQuery } from "./active-subscription";

/**
 * Plus makes every certificate the learner earned one they can show, dated when they earned it,
 * and an issued one stays issued after Plus ends. Every write that can give Plus calls this in its
 * transaction, and every award does after writing rows, both under the learner's lock: whichever
 * commits second sees the other.
 *
 * `granted` trusts a verified grant, such as a Stripe event, instead of re-reading our copy of the
 * subscription, which a cancellation or refund may have ended since. `check` reads it in `tx`.
 * Guests are never Plus.
 */
export async function issueEarnedCertificates(
  tx: TransactionClient,
  { now, plus, userId }: { now: Date; plus: "check" | "granted"; userId: string },
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
    where: { issuedAt: null, userId },
  });

  return issued.count;
}
