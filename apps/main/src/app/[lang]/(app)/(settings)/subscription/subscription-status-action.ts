"use server";

import { getCurrentPlusSubscription } from "@/data/subscriptions/get-current-plus-subscription";

/** One subscription read each time, instead of reading the whole page again. */
export async function hasPlusSubscriptionAction(): Promise<boolean> {
  return Boolean(await getCurrentPlusSubscription());
}
