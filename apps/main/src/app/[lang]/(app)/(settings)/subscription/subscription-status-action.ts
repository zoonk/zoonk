"use server";

import { getCurrentPlusSubscription } from "@/data/subscriptions/get-current-plus-subscription";

/**
 * Whether Stripe's webhook saved the learner's Plus subscription yet, for the page that waits on it
 * after the checkout: one subscription read each time it asks, the same the page shows the plan
 * from, instead of reading the whole page again.
 */
export async function hasPlusSubscriptionAction(): Promise<boolean> {
  return Boolean(await getCurrentPlusSubscription());
}
