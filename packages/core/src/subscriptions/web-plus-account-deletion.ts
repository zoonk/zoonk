import "server-only";
import { sendPlusCancellationEmail } from "@zoonk/auth/plus-emails";
import { readSubscriptionMetadata } from "@zoonk/auth/stripe-subscription-metadata";
import { type PriceInfo } from "@zoonk/utils/currency";
import {
  type Learner,
  type WebPlusCancellation,
  loadCancellation,
} from "./_utils/load-web-plus-cancellation";
import { refundLatestPayment, saveSubscription, stopSubscription } from "./_utils/stop-web-plus";

type ReadyCancellation = Extract<WebPlusCancellation, { status: "ready" }>;

export function getAccountDeletionRefund(cancellation: ReadyCancellation): PriceInfo | null {
  const amount = cancellation.accountDeletionRefund;
  return amount > 0 ? { amount, currency: cancellation.currency } : null;
}

/**
 * Ends the account's website Plus before the account is deleted, refunding what the Terms give. The
 * receipt goes to the account's email. A failure throws so the deletion stops, and a retry finishes
 * it.
 */
export async function endWebPlusForDeletedAccount({
  learner,
}: {
  learner: Learner;
}): Promise<void> {
  const receivedAt = new Date();
  const { cancellation, stripeSubscription } = await loadCancellation({ learner, now: receivedAt });

  if (cancellation.status !== "ready" || !stripeSubscription) {
    return;
  }

  const refunded = getAccountDeletionRefund(cancellation);

  if (refunded) {
    await refundLatestPayment({ owed: refunded.amount, subscription: stripeSubscription });
  }

  const stopped = await stopSubscription({
    endsAt: receivedAt,
    endsNow: true,
    reason: null,
    subscription: stripeSubscription,
  });

  await saveSubscription({ subscription: stopped, userId: learner.id });

  await sendPlusCancellationEmail({
    canKeepPlus: false,
    choice: refunded && cancellation.withdrawal !== null ? "withdrawal" : "ordinary",
    email: learner.email,
    endsAt: receivedAt,
    interval: cancellation.interval,
    lateWithdrawal: false,
    locale: readSubscriptionMetadata(stripeSubscription.metadata).locale,
    name: learner.name,
    reason: null,
    receivedAt,
    refund: refunded,
    refundableUntil: null,
    source: "accountDeletion",
    timeZone: cancellation.timeZone,
  });
}
