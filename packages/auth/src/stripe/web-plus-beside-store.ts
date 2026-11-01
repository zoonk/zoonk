import { prisma } from "@zoonk/db";
import { ACTIVE_SUBSCRIPTION_STATUSES, getActiveSubscriptionQuery } from "../active-subscription";
import { stripeClient } from "./client";
import { sendWebPlusEndedBesideStoreEmail } from "./duplicate-plus-emails";
import {
  UNPAID_STATUSES,
  getLatestInvoice,
  isUnpaid,
  refundLatestPayment,
  saveSubscription,
  stopSubscription,
} from "./stop-web-plus";
import { readSubscriptionMetadata } from "./subscription-metadata";

type StoreProvider = "apple" | "google";

function findStorePlus(userId: string) {
  const { orderBy, where } = getActiveSubscriptionQuery({ now: new Date(), userId });

  return prisma.subscription.findFirst({
    orderBy,
    where: { ...where, provider: { in: ["apple", "google"] } },
  });
}

/** An unpaid renewal gives no Plus, but Stripe keeps trying to charge it. */
function findBilledWebPlus(userId: string) {
  return prisma.subscription.findMany({
    where: {
      provider: "stripe",
      referenceId: userId,
      status: { in: [...ACTIVE_SUBSCRIPTION_STATUSES, ...UNPAID_STATUSES] },
      stripeSubscriptionId: { not: null },
    },
  });
}

async function endWebPlus({
  email,
  store,
  stripeSubscriptionId,
  userId,
}: {
  email: string;
  store: StoreProvider;
  stripeSubscriptionId: string;
  userId: string;
}): Promise<boolean> {
  const subscription = await stripeClient.subscriptions.retrieve(stripeSubscriptionId, {
    expand: ["latest_invoice.payments"],
  });

  if (!ACTIVE_SUBSCRIPTION_STATUSES.includes(subscription.status) && !isUnpaid(subscription)) {
    return false;
  }

  const invoice = getLatestInvoice(subscription);
  const paid = isUnpaid(subscription) ? 0 : (invoice?.amount_paid ?? 0);

  if (paid > 0) {
    await refundLatestPayment({ owed: paid, subscription });
  }

  const stopped = await stopSubscription({
    endsAt: new Date(),
    endsNow: true,
    reason: `Plus through ${store === "apple" ? "the App Store" : "Google Play"} too`,
    subscription,
  });

  await saveSubscription({ subscription: stopped, userId });

  await sendWebPlusEndedBesideStoreEmail({
    ...readSubscriptionMetadata(subscription.metadata),
    email,
    interval: subscription.items.data[0]?.price.recurring?.interval === "year" ? "year" : "month",
    refund: invoice && paid > 0 ? { amount: paid, currency: invoice.currency } : null,
    store,
  });

  return true;
}

/**
 * A store charges before we hear of its purchase, so it can't be refused: when the learner also
 * has website Plus, the website one ends now with its last payment refunded in full. It acts only
 * on a subscription Stripe still bills, so a retry finishes a failed run without repeating it.
 * Returns whether it ended one.
 */
export async function endWebPlusBesideStorePlus(userId: string): Promise<boolean> {
  const [storePlus, webPlus] = await Promise.all([
    findStorePlus(userId),
    findBilledWebPlus(userId),
  ]);

  const store = storePlus?.provider;

  if ((store !== "apple" && store !== "google") || webPlus.length === 0) {
    return false;
  }

  const { email } = await prisma.user.findUniqueOrThrow({
    select: { email: true },
    where: { id: userId },
  });

  const ended = await Promise.all(
    webPlus.flatMap(({ stripeSubscriptionId }) =>
      stripeSubscriptionId ? [endWebPlus({ email, store, stripeSubscriptionId, userId })] : [],
    ),
  );

  return ended.includes(true);
}
