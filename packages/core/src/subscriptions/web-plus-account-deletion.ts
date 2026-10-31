import "server-only";
import { sendPlusCancellationEmail } from "@zoonk/auth/plus-emails";
import { readSubscriptionMetadata } from "@zoonk/auth/stripe-subscription-metadata";
import { prisma } from "@zoonk/db";
import { type PriceInfo } from "@zoonk/utils/currency";
import {
  type Learner,
  type WebPlusCancellation,
  loadCancellation,
} from "./_utils/load-web-plus-cancellation";
import {
  refundEveryPayment,
  refundLatestPayment,
  saveSubscription,
  stopSubscription,
} from "./_utils/stop-web-plus";
import type Stripe from "stripe";

type ReadyCancellation = Extract<WebPlusCancellation, { status: "ready" }>;

export function getAccountDeletionRefund(cancellation: ReadyCancellation): PriceInfo | null {
  const amount = cancellation.accountDeletionRefund;
  return amount > 0 ? { amount, currency: cancellation.currency } : null;
}

/** Checkout keeps the customer on the user; each website subscription keeps its own copy. */
async function findStripeCustomers(userId: string): Promise<string[]> {
  const [user, subscriptions] = await Promise.all([
    prisma.user.findUnique({ select: { stripeCustomerId: true }, where: { id: userId } }),
    prisma.subscription.findMany({
      select: { stripeCustomerId: true },
      where: { provider: "stripe", referenceId: userId, stripeCustomerId: { not: null } },
    }),
  ]);

  const customers = [user, ...subscriptions].map((row) => row?.stripeCustomerId);
  return [...new Set(customers.filter((customer) => customer !== null && customer !== undefined))];
}

async function refundForDeletion({
  learner,
  live,
  refund,
  subscription,
}: {
  learner: Learner;
  live: ReadyCancellation | null;
  refund: "everything" | "terms";
  subscription: Stripe.Subscription | null;
}): Promise<PriceInfo | null> {
  if (refund === "everything") {
    return refundEveryPayment(await findStripeCustomers(learner.id));
  }

  const owed = live && getAccountDeletionRefund(live);

  if (owed && subscription) {
    await refundLatestPayment({ owed: owed.amount, subscription });
  }

  return owed;
}

/**
 * Ends the account's website Plus before the account is deleted, refunding what the Terms give, or
 * every website payment the account ever made when it's below the minimum age (Terms § 2), even
 * with no Plus left. The receipt goes to the account's email while Plus was live. A failure throws
 * so the deletion stops, and a retry finishes it.
 */
export async function endWebPlusForDeletedAccount({
  learner,
  refund,
}: {
  learner: Learner;
  refund: "everything" | "terms";
}): Promise<void> {
  const receivedAt = new Date();
  const { cancellation, stripeSubscription } = await loadCancellation({ learner, now: receivedAt });
  const live = cancellation.status === "ready" ? cancellation : null;

  const refunded = await refundForDeletion({
    learner,
    live,
    refund,
    subscription: stripeSubscription,
  });

  if (!live || !stripeSubscription) {
    return;
  }

  const stopped = await stopSubscription({
    endsAt: receivedAt,
    endsNow: true,
    reason: null,
    subscription: stripeSubscription,
  });

  await saveSubscription({ subscription: stopped, userId: learner.id });

  const fullRefund = refund === "everything" || live.withdrawal !== null;

  await sendPlusCancellationEmail({
    canKeepPlus: false,
    choice: refunded && fullRefund ? "withdrawal" : "ordinary",
    email: learner.email,
    endsAt: receivedAt,
    interval: live.interval,
    lateWithdrawal: false,
    locale: readSubscriptionMetadata(stripeSubscription.metadata).locale,
    name: learner.name,
    reason: null,
    receivedAt,
    refund: refunded,
    refundableUntil: null,
    source: "accountDeletion",
    timeZone: live.timeZone,
  });
}
