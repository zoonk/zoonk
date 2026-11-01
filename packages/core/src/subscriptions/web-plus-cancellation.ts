import "server-only";
import { stripeClient } from "@zoonk/auth/stripe-client";
import { io } from "next/cache";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getUserSubscriptionCacheTag } from "../cache/tags";
import { getSession } from "../users/get-session";
import { type WebPlusCancellation, loadCancellation } from "./_utils/load-web-plus-cancellation";
import {
  endSubscription,
  isUnpaid,
  resumeSubscription,
  saveStoppedSubscription,
  saveSubscription,
} from "@zoonk/auth/stop-web-plus";

type WebPlusCancellationOutcome =
  | { status: "canceled"; endsAt: Date; receivedAt: Date }
  | { status: "unavailable" };

async function getLearner() {
  const session = await getSession();
  return session && !session.user.isAnonymous ? session.user : null;
}

export async function getWebPlusCancellation(): Promise<WebPlusCancellation | null> {
  const learner = await getLearner();

  if (!learner) {
    return null;
  }

  await io();
  const { cancellation } = await loadCancellation({ learner, now: new Date() });
  return cancellation;
}

export async function cancelWebPlus(): Promise<WebPlusCancellationOutcome | null> {
  const learner = await getLearner();

  if (!learner) {
    return null;
  }

  const receivedAt = new Date();
  const { cancellation, stripeSubscription } = await loadCancellation({ learner, now: receivedAt });

  if (cancellation.status !== "ready" || !cancellation.cancellation || !stripeSubscription) {
    return { status: "unavailable" };
  }

  const unpaid = isUnpaid(stripeSubscription);

  const stopped = unpaid
    ? await endSubscription(stripeSubscription)
    : await stripeClient.subscriptions.update(stripeSubscription.id, {
        cancel_at_period_end: true,
      });

  await saveStoppedSubscription({ stopped, userId: learner.id });
  revalidateCacheTags([getUserSubscriptionCacheTag(learner.id)]);

  return { endsAt: cancellation.cancellation.endsAt, receivedAt, status: "canceled" };
}

export async function keepWebPlus(): Promise<{ status: "kept" | "unavailable" } | null> {
  const learner = await getLearner();

  if (!learner) {
    return null;
  }

  const { cancellation, stripeSubscription } = await loadCancellation({ learner, now: new Date() });

  if (cancellation.status !== "ready" || !cancellation.canResumeRenewal || !stripeSubscription) {
    return { status: "unavailable" };
  }

  const resumed = await resumeSubscription(stripeSubscription);
  await saveSubscription(resumed);
  revalidateCacheTags([getUserSubscriptionCacheTag(learner.id)]);
  return { status: "kept" };
}
