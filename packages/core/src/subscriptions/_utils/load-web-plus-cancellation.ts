import "server-only";
import { stripeClient } from "@zoonk/auth/stripe-client";
import { findWebSubscription } from "../../learner/facts/web-subscription";
import { isUnpaid } from "@zoonk/auth/stop-web-plus";
import type Stripe from "stripe";

export function isPendingCancel(subscription: Stripe.Subscription): boolean {
  return subscription.cancel_at_period_end || subscription.cancel_at !== null;
}

export async function loadStripeWebSubscription(
  userId: string,
): Promise<Stripe.Subscription | null> {
  const saved = await findWebSubscription(userId);

  if (!saved?.stripeSubscriptionId) {
    return null;
  }

  const subscription = await stripeClient.subscriptions.retrieve(saved.stripeSubscriptionId);
  return subscription.status === "active" || isUnpaid(subscription) ? subscription : null;
}
