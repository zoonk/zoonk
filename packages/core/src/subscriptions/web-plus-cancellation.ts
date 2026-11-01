import "server-only";
import { stripeClient } from "@zoonk/auth/stripe-client";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getUserSubscriptionCacheTag } from "../cache/tags";
import { getSession } from "../users/get-session";
import { isPendingCancel, loadStripeWebSubscription } from "./_utils/load-web-plus-cancellation";
import {
  endSubscription,
  isUnpaid,
  resumeSubscription,
  saveStoppedSubscription,
  saveSubscription,
  toDate,
} from "@zoonk/auth/stop-web-plus";
import type Stripe from "stripe";

type WebPlusCancellationOutcome =
  | { status: "canceled"; endsAt: Date }
  | { status: "unavailable" }
  | { status: "none" };

async function getLearner() {
  const session = await getSession();
  return session?.user ?? null;
}

function getCancellationEnd(subscription: Stripe.Subscription): Date | null {
  if (isUnpaid(subscription)) {
    return new Date();
  }

  const item = subscription.items.data[0];
  return item && !isPendingCancel(subscription) ? toDate(item.current_period_end) : null;
}

export async function cancelWebPlus(): Promise<WebPlusCancellationOutcome | null> {
  const learner = await getLearner();

  if (!learner) {
    return null;
  }

  if (learner.isAnonymous) {
    return { status: "none" };
  }

  const subscription = await loadStripeWebSubscription(learner.id);
  const endsAt = subscription && getCancellationEnd(subscription);

  if (!subscription || !endsAt) {
    return { status: "unavailable" };
  }

  const stopped = isUnpaid(subscription)
    ? await endSubscription(subscription)
    : await stripeClient.subscriptions.update(subscription.id, { cancel_at_period_end: true });

  await saveStoppedSubscription({ stopped, userId: learner.id });
  revalidateCacheTags([getUserSubscriptionCacheTag(learner.id)]);
  return { endsAt, status: "canceled" };
}

export async function keepWebPlus(): Promise<{ status: "kept" | "unavailable" | "none" } | null> {
  const learner = await getLearner();

  if (!learner) {
    return null;
  }

  if (learner.isAnonymous) {
    return { status: "none" };
  }

  const subscription = await loadStripeWebSubscription(learner.id);

  if (!subscription || isUnpaid(subscription) || !isPendingCancel(subscription)) {
    return { status: "unavailable" };
  }

  const resumed = await resumeSubscription(subscription);
  await saveSubscription(resumed);
  revalidateCacheTags([getUserSubscriptionCacheTag(learner.id)]);
  return { status: "kept" };
}
