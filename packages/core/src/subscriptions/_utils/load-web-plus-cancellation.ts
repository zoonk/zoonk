import "server-only";
import { stripeClient } from "@zoonk/auth/stripe-client";
import { prisma } from "@zoonk/db";
import { findActiveSubscriptionForUser } from "../../auth/subscription";
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

  // An early `cancel_at` shortens the item's current period; the invoice line keeps the period paid for.
  const paidPeriod = invoice?.lines.data[0]?.period;

  if (!item || !invoice || !paidPeriod) {
    return { email: learner.email, status: "none" };
  }

  const interval: BillingInterval = item.price.recurring?.interval === "year" ? "year" : "month";
  const ready = { currency: invoice.currency, email: learner.email, interval, name: learner.name };

  if (isUnpaid(subscription)) {
    return {
      ...ready,
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

  const { cancellation, extraordinary, withdrawal } = getWebPlusCancellationTerms({
    amountPaid: invoice.amount_paid,
    endingAt,
    interval,
    now,
    periodEnd: toDate(paidPeriod.end),
    periodStart: toDate(paidPeriod.start),
    subscribedAt: toDate(subscription.start_date),
  });

  return {
    ...ready,
    cancellation: endingAt ? null : cancellation,
    endingAt,
    extraordinary,
    status: "ready",
    unpaid: false,
    withdrawal,
  };
}

function findUnpaidWebSubscription(userId: string) {
  return prisma.subscription.findFirst({
    orderBy: { id: "desc" },
    where: { provider: "stripe", referenceId: userId, status: { in: UNPAID_STATUSES } },
  });
}

export async function loadCancellation({
  learner,
  now,
}: {
  learner: Learner;
  now: Date;
}): Promise<LoadedCancellation> {
  const subscription =
    (await findActiveSubscriptionForUser({ now, userId: learner.id })) ??
    (await findUnpaidWebSubscription(learner.id));

  if (!subscription) {
    return { cancellation: { email: learner.email, status: "none" }, stripeSubscription: null };
  }

  if (subscription.provider !== "stripe") {
    return {
      cancellation: { provider: subscription.provider, status: "store" },
      stripeSubscription: null,
    };
  }

  const stripeSubscription = subscription.stripeSubscriptionId
    ? await readLiveStripeSubscription(subscription.stripeSubscriptionId)
    : null;

  if (!stripeSubscription) {
    return { cancellation: { email: learner.email, status: "none" }, stripeSubscription: null };
  }

  return {
    cancellation: describeCancellation({ learner, now, subscription: stripeSubscription }),
    stripeSubscription,
  };
}

type LoadedCancellation = {
  cancellation: WebPlusCancellation;
  stripeSubscription: Stripe.Subscription | null;
};
