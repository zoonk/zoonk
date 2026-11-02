import "server-only";
import { isUnpaid } from "@zoonk/auth/stop-web-plus";
import { cacheTag } from "next/cache";
import { getUserSubscriptionCacheTag } from "../cache/tags";
import { readWebSubscription } from "../learner/facts/web-subscription";
import { getSession } from "../users/get-session";

type WebPlusSubscription =
  | { status: "none" }
  | { status: "ready"; state: "renewing" | "ending" | "unpaid"; periodEnd: Date | null };

export async function getWebPlusSubscription(): Promise<WebPlusSubscription | null> {
  "use cache: private";
  const session = await getSession();

  if (!session) {
    return null;
  }

  if (session.user.isAnonymous) {
    return { status: "none" };
  }

  cacheTag(getUserSubscriptionCacheTag(session.user.id));
  const subscription = await readWebSubscription(session.user.id);

  if (!subscription) {
    return { status: "none" };
  }

  if (isUnpaid(subscription)) {
    return { periodEnd: null, state: "unpaid", status: "ready" };
  }

  if (subscription.cancelAt || subscription.cancelAtPeriodEnd) {
    return {
      periodEnd: subscription.cancelAt ?? subscription.periodEnd,
      state: "ending",
      status: "ready",
    };
  }

  return { periodEnd: subscription.periodEnd, state: "renewing", status: "ready" };
}
