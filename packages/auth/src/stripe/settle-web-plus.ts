import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { ACTIVE_SUBSCRIPTION_STATUSES, getActiveSubscriptionQuery } from "../active-subscription";
import { stripeClient } from "./client";
import { type EndedWebPlus, sendWebPlusEndedEmail } from "./duplicate-plus-emails";
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
type Learner = { email: string; id: string };

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

/**
 * Two checkouts started at once can each make the learner a Stripe customer; each of their rows
 * keeps its own.
 */
async function findStripeCustomers(userId: string): Promise<string[]> {
  const [user, rows] = await Promise.all([
    prisma.user.findUnique({ select: { stripeCustomerId: true }, where: { id: userId } }),
    prisma.subscription.findMany({
      distinct: ["stripeCustomerId"],
      select: { stripeCustomerId: true },
      where: { provider: "stripe", referenceId: userId, stripeCustomerId: { not: null } },
    }),
  ]);

  const ids = [user?.stripeCustomerId, ...rows.map((row) => row.stripeCustomerId)];
  return [...new Set(ids.filter((id) => id !== null && id !== undefined))];
}

/** Stripe's own list, so a subscription no row points to is found too. */
async function listBilledWebPlus(customerIds: string[]): Promise<string[]> {
  const lists = await Promise.all(
    customerIds.map((customer) => stripeClient.subscriptions.list({ customer, limit: 100 })),
  );

  return lists.flatMap(({ data }) =>
    data.filter((subscription) => isBilled(subscription)).map(({ id }) => id),
  );
}

/**
 * The refund goes first, so a failure never leaves it canceled unrefunded, and it acts only on a
 * subscription Stripe still bills, so a retry finishes a failed run without repeating it. Once
 * Stripe has ended it, the learner is told at once, even if our copy isn't saved: Stripe's
 * deletion webhook saves it too, and a retry would no longer find it to tell.
 */
async function endWebPlus({
  keptStore,
  learner,
  subscriptionId,
}: {
  keptStore: StoreProvider;
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
    reason: `Plus through ${keptStore === "apple" ? "the App Store" : "Google Play"} too`,
    subscription,
  });

  const { error } = await safeAsync(() => saveSubscription(stopped));

  if (error) {
    logError("Saving website Plus ended beside store Plus failed", { error, subscriptionId });
  }

  const notice: EndedWebPlus = {
    ...readSubscriptionMetadata(subscription.metadata),
    email: learner.email,
    interval: subscription.items.data[0]?.price.recurring?.interval === "year" ? "year" : "month",
    keptStore,
    refund: invoice && paid > 0 ? { amount: paid, currency: invoice.currency } : null,
  };

  const { error: emailError } = await safeAsync(() => sendWebPlusEndedEmail(notice));

  if (emailError) {
    logError("Plus email failed", { error: emailError, subscriptionId });
  }

  return notice;
}

/**
 * A store charges before we hear of its purchase, so it can't be refused: when the learner has
 * store Plus, every website subscription Stripe still bills ends now, its last payment refunded in
 * full, and the learner is told. Every caller reaches the same end, however often or in whatever
 * order it runs. A completed checkout names its own customer, which our rows may not keep.
 */
export async function endWebPlusBesideStorePlus({
  customerId,
  userId,
}: {
  customerId?: string;
  userId: string;
}): Promise<EndedWebPlus[]> {
  const [keptStore, knownCustomers, learner] = await Promise.all([
    findStorePlus(userId),
    findStripeCustomers(userId),
    prisma.user.findUnique({ select: { email: true, id: true }, where: { id: userId } }),
  ]);

  const customerIds = [...new Set([...knownCustomers, ...(customerId ? [customerId] : [])])];

  if (!keptStore || !learner || customerIds.length === 0) {
    return [];
  }

  const billed = await listBilledWebPlus(customerIds);

  // Each one finishes before a failure is thrown, so ending one never cuts another short.
  const results = await Promise.allSettled(
    billed.map((subscriptionId) => endWebPlus({ keptStore, learner, subscriptionId })),
  );

  const failed = results.find((result) => result.status === "rejected");

  if (failed) {
    throw failed.reason;
  }

  return results.flatMap((result) =>
    result.status === "fulfilled" && result.value ? [result.value] : [],
  );
}
