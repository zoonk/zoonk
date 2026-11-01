import "server-only";
import { stripeClient } from "@zoonk/auth/stripe-client";
import { prisma } from "@zoonk/db";
import { findActiveSubscriptionForUser } from "../../auth/subscription";
import { ACTIVE_SUBSCRIPTION_STATUSES } from "@zoonk/auth/active-subscription";
import { UNPAID_STATUSES, isUnpaid, toDate } from "@zoonk/auth/stop-web-plus";
import type Stripe from "stripe";

export type Learner = { id: string };

export type WebPlusCancellation =
  | { status: "none" }
  | { status: "store"; provider: "apple" | "google" | "zoonk" }
  | {
      status: "ready";
      canResumeRenewal: boolean;
      cancellation: { endsAt: Date } | null;
      unpaid: boolean;
    };

function isPendingCancel(subscription: Stripe.Subscription): boolean {
  return subscription.cancel_at_period_end || subscription.cancel_at !== null;
}

async function readLiveStripeSubscription(id: string): Promise<Stripe.Subscription | null> {
  const subscription = await stripeClient.subscriptions.retrieve(id);

  return ACTIVE_SUBSCRIPTION_STATUSES.includes(subscription.status) || isUnpaid(subscription)
    ? subscription
    : null;
}

function describeCancellation({
  now,
  subscription,
}: {
  now: Date;
  subscription: Stripe.Subscription;
}): WebPlusCancellation {
  const item = subscription.items.data[0];

  if (!item) {
    return { status: "none" };
  }

  if (isUnpaid(subscription)) {
    return {
      canResumeRenewal: false,
      cancellation: { endsAt: now },
      status: "ready",
      unpaid: true,
    };
  }

  const pending = isPendingCancel(subscription);

  return {
    canResumeRenewal: pending,
    cancellation: pending ? null : { endsAt: toDate(item.current_period_end) },
    status: "ready",
    unpaid: false,
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
      cancellation: describeCancellation({ now, subscription: stripeSubscription }),
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

  return { cancellation: { status: "none" }, stripeSubscription: null };
}

type LoadedCancellation = {
  cancellation: WebPlusCancellation;
  stripeSubscription: Stripe.Subscription | null;
};
