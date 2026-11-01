import "server-only";
import { stripeClient } from "@zoonk/auth/stripe-client";
import { readSubscriptionMetadata } from "@zoonk/auth/stripe-subscription-metadata";
import { prisma } from "@zoonk/db";
import { findActiveSubscriptionForUser } from "../../auth/subscription";
import { ACTIVE_SUBSCRIPTION_STATUSES } from "../../learner/facts/subscription";
import { getWebPlusCancellationTerms } from "../web-plus-cancellation-terms";
import { UNPAID_STATUSES, getLatestInvoice, isUnpaid, toDate } from "./stop-web-plus";
import type Stripe from "stripe";

type BillingInterval = "month" | "year";
type Terms = ReturnType<typeof getWebPlusCancellationTerms>;
export type Learner = { email: string; id: string; name: string };

export type WebPlusCancellation =
  | { status: "none"; email: string }
  | { status: "store"; provider: "apple" | "google" | "zoonk" }
  | {
      status: "ready";
      accountDeletionRefund: number;
      canResumeRenewal: boolean;
      /** Null once the renewal is already stopped. */
      cancellation: Terms["cancellation"] | null;
      currency: string;
      email: string;
      /** When Plus ends, if the renewal is already stopped. */
      endingAt: Date | null;
      /** Null for an unpaid renewal, whose cancel already ends it now. */
      extraordinary: Terms["extraordinary"] | null;
      interval: BillingInterval;
      name: string;
      /** Where the learner subscribed, or UTC when unknown: dates are shown in it. */
      timeZone: string;
      /** The last renewal wasn't paid: canceling ends it now and stops the charge attempts. */
      unpaid: boolean;
      withdrawal: Terms["withdrawal"];
    };

function isPendingCancel(subscription: Stripe.Subscription): boolean {
  return subscription.cancel_at_period_end || subscription.cancel_at !== null;
}

async function readLiveStripeSubscription(id: string): Promise<Stripe.Subscription | null> {
  const subscription = await stripeClient.subscriptions.retrieve(id, {
    expand: ["latest_invoice.payments"],
  });

  return subscription.status === "active" || isUnpaid(subscription) ? subscription : null;
}

function describeCancellation({
  learner,
  now,
  subscription,
}: {
  learner: Learner;
  now: Date;
  subscription: Stripe.Subscription;
}): WebPlusCancellation {
  const item = subscription.items.data[0];
  const invoice = getLatestInvoice(subscription);

  // An early `cancel_at` shortens the item's current period; the item's own line keeps the period
  // paid for, after any proration lines.
  const paidPeriod = invoice?.lines.data.find((line) => {
    const details = line.parent?.subscription_item_details;
    return details?.subscription_item === item?.id && details?.proration === false;
  })?.period;

  if (!item || !invoice || !paidPeriod) {
    return { email: learner.email, status: "none" };
  }

  const interval: BillingInterval = item.price.recurring?.interval === "year" ? "year" : "month";
  const { timeZone } = readSubscriptionMetadata(subscription.metadata);

  const ready = {
    currency: invoice.currency,
    email: learner.email,
    interval,
    name: learner.name,
    timeZone: timeZone ?? "UTC",
  };

  if (isUnpaid(subscription)) {
    return {
      ...ready,
      accountDeletionRefund: 0,
      canResumeRenewal: false,
      cancellation: { endsAt: now, refundAmount: 0, unstartedMonths: 0 },
      endingAt: null,
      extraordinary: null,
      status: "ready",
      unpaid: true,
      withdrawal: null,
    };
  }

  const endingAt = isPendingCancel(subscription)
    ? toDate(subscription.cancel_at ?? item.current_period_end)
    : null;

  const periodEnd = toDate(paidPeriod.end);

  const { accountDeletionRefund, cancellation, extraordinary, withdrawal } =
    getWebPlusCancellationTerms({
      amountPaid: invoice.amount_paid,
      endingAt,
      interval,
      now,
      periodEnd,
      periodStart: toDate(paidPeriod.start),
      subscribedAt: toDate(subscription.start_date),
      timeZone,
    });

  return {
    ...ready,
    accountDeletionRefund,
    canResumeRenewal: endingAt !== null && endingAt >= periodEnd,
    cancellation: endingAt ? null : cancellation,
    endingAt,
    extraordinary,
    status: "ready",
    unpaid: false,
    withdrawal,
  };
}

/**
 * Looked up apart from which Plus the learner sees: a store purchase made alongside it doesn't stop
 * the website's from billing. A renewing one comes before an unpaid one.
 */
async function findWebSubscription(userId: string) {
  const findByStatus = (statuses: string[]) =>
    prisma.subscription.findFirst({
      orderBy: { id: "desc" },
      where: { provider: "stripe", referenceId: userId, status: { in: statuses } },
    });

  return (
    (await findByStatus(ACTIVE_SUBSCRIPTION_STATUSES)) ?? (await findByStatus(UNPAID_STATUSES))
  );
}

export async function loadCancellation({
  learner,
  now,
}: {
  learner: Learner;
  now: Date;
}): Promise<LoadedCancellation> {
  const webSubscription = await findWebSubscription(learner.id);

  const stripeSubscription = webSubscription?.stripeSubscriptionId
    ? await readLiveStripeSubscription(webSubscription.stripeSubscriptionId)
    : null;

  if (stripeSubscription) {
    return {
      cancellation: describeCancellation({ learner, now, subscription: stripeSubscription }),
      stripeSubscription,
    };
  }

  const subscription = await findActiveSubscriptionForUser({ now, userId: learner.id });

  if (subscription && subscription.provider !== "stripe") {
    return {
      cancellation: { provider: subscription.provider, status: "store" },
      stripeSubscription: null,
    };
  }

  return { cancellation: { email: learner.email, status: "none" }, stripeSubscription: null };
}

type LoadedCancellation = {
  cancellation: WebPlusCancellation;
  stripeSubscription: Stripe.Subscription | null;
};
