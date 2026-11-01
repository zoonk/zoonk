import { prisma } from "@zoonk/db";
import { ACTIVE_SUBSCRIPTION_STATUSES, getActiveSubscriptionQuery } from "../active-subscription";
import { stripeClient } from "./client";
import { type EndedWebPlus } from "./duplicate-plus-emails";
import {
  getLatestInvoice,
  isUnpaid,
  refundLatestPayment,
  saveSubscription,
  stopSubscription,
} from "./stop-web-plus";
import { readSubscriptionMetadata } from "./subscription-metadata";
import type Stripe from "stripe";

type StoreProvider = "apple" | "google";
type Learner = { email: string; id: string; stripeCustomerId: string };

/** An unpaid renewal gives no Plus, but Stripe keeps trying to charge it. */
function isBilled(subscription: Stripe.Subscription): boolean {
  return ACTIVE_SUBSCRIPTION_STATUSES.includes(subscription.status) || isUnpaid(subscription);
}

export async function findStorePlus(userId: string): Promise<StoreProvider | null> {
  const { orderBy, where } = getActiveSubscriptionQuery({ now: new Date(), userId });

  const subscription = await prisma.subscription.findFirst({
    orderBy,
    where: { ...where, provider: { in: ["apple", "google"] } },
  });

  return subscription?.provider === "apple" || subscription?.provider === "google"
    ? subscription.provider
    : null;
}

async function findLearner(userId: string): Promise<Learner | null> {
  const user = await prisma.user.findUnique({
    select: { email: true, id: true, stripeCustomerId: true },
    where: { id: userId },
  });

  return user?.stripeCustomerId ? { ...user, stripeCustomerId: user.stripeCustomerId } : null;
}

/** Stripe's own list, so a subscription no row points to is found too. */
async function listBilledWebPlus(customerId: string): Promise<string[]> {
  const { data } = await stripeClient.subscriptions.list({ customer: customerId, limit: 100 });
  return data.filter((subscription) => isBilled(subscription)).map(({ id }) => id);
}

/**
 * The refund goes first, so a failure never leaves it canceled unrefunded, and it acts only on a
 * subscription Stripe still bills, so a retry finishes a failed run without repeating it.
 */
async function endWebPlus({
  keptStore,
  learner,
  subscriptionId,
}: {
  keptStore: StoreProvider | null;
  learner: Learner;
  subscriptionId: string;
}): Promise<EndedWebPlus | null> {
  const subscription = await stripeClient.subscriptions.retrieve(subscriptionId, {
    expand: ["latest_invoice.payments"],
  });

  if (!isBilled(subscription)) {
    return null;
  }

  const invoice = getLatestInvoice(subscription);
  const paid = isUnpaid(subscription) ? 0 : (invoice?.amount_paid ?? 0);

  if (paid > 0) {
    await refundLatestPayment({ owed: paid, subscription });
  }

  const stopped = await stopSubscription({
    endsAt: new Date(),
    endsNow: true,
    reason: keptStore
      ? `Plus through ${keptStore === "apple" ? "the App Store" : "Google Play"} too`
      : "A second website Plus",
    subscription,
  });

  await saveSubscription({ subscription: stopped, userId: learner.id });

  return {
    ...readSubscriptionMetadata(subscription.metadata),
    email: learner.email,
    interval: subscription.items.data[0]?.price.recurring?.interval === "year" ? "year" : "month",
    keptStore,
    refund: invoice && paid > 0 ? { amount: paid, currency: invoice.currency } : null,
  };
}

async function endWebPlusOtherThan({
  keep,
  keptStore,
  learner,
}: {
  keep: string | null;
  keptStore: StoreProvider | null;
  learner: Learner;
}): Promise<EndedWebPlus[]> {
  const billed = await listBilledWebPlus(learner.stripeCustomerId);

  const ended = await Promise.all(
    billed
      .filter((subscriptionId) => subscriptionId !== keep)
      .map((subscriptionId) => endWebPlus({ keptStore, learner, subscriptionId })),
  );

  return ended.filter((notice) => notice !== null);
}

/**
 * A checkout opened while free can complete after a store purchase, or beside another checkout
 * the learner also paid: the learner keeps store Plus, or the website subscription this checkout
 * made, and every other website subscription ends now with its last payment refunded in full.
 */
export async function settleWebPlusCheckout({
  subscriptionId,
  userId,
}: {
  subscriptionId: string;
  userId: string;
}): Promise<EndedWebPlus[]> {
  const [learner, keptStore] = await Promise.all([findLearner(userId), findStorePlus(userId)]);

  if (!learner) {
    return [];
  }

  return endWebPlusOtherThan({ keep: keptStore ? null : subscriptionId, keptStore, learner });
}

/** A store charges before we hear of its purchase, so website Plus beside store Plus ends instead. */
export async function endWebPlusBesideStorePlus(userId: string): Promise<EndedWebPlus[]> {
  const [learner, keptStore] = await Promise.all([findLearner(userId), findStorePlus(userId)]);

  if (!learner || !keptStore) {
    return [];
  }

  return endWebPlusOtherThan({ keep: null, keptStore, learner });
}
