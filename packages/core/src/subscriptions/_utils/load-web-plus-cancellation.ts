import "server-only";
import { isUnpaid, saveSubscription, toDate } from "@zoonk/auth/stop-web-plus";
import { stripeClient } from "@zoonk/auth/stripe-client";
import { type Subscription } from "@zoonk/db";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getUserSubscriptionCacheTag } from "../../cache/tags";
import { findWebSubscription } from "../../learner/facts/web-subscription";
import type Stripe from "stripe";

export function isPendingCancel(subscription: Stripe.Subscription): boolean {
  return subscription.cancel_at_period_end || subscription.cancel_at !== null;
}

function hasBillingStateChanged({
  saved,
  live,
}: {
  saved: Subscription;
  live: Stripe.Subscription;
}): boolean {
  const periodEnd = live.items.data[0]?.current_period_end;

  return (
    saved.status !== live.status ||
    Boolean(saved.cancelAtPeriodEnd) !== live.cancel_at_period_end ||
    (saved.cancelAt?.getTime() ?? null) !==
      (live.cancel_at ? toDate(live.cancel_at).getTime() : null) ||
    (periodEnd !== undefined && saved.periodEnd?.getTime() !== toDate(periodEnd).getTime())
  );
}

export async function loadStripeWebSubscription(
  userId: string,
): Promise<Stripe.Subscription | null> {
  const saved = await findWebSubscription(userId);

  if (!saved?.stripeSubscriptionId) {
    return null;
  }

  const subscription = await stripeClient.subscriptions.retrieve(saved.stripeSubscriptionId);

  if (hasBillingStateChanged({ live: subscription, saved })) {
    await saveSubscription({ subscription, userId });
    revalidateCacheTags([getUserSubscriptionCacheTag(userId)]);
    return null;
  }

  return subscription.status === "active" || isUnpaid(subscription) ? subscription : null;
}
