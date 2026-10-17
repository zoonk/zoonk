import { getActiveSubscription } from "@zoonk/core/auth/subscription";
import { type Subscription } from "@zoonk/db";
import { PLUS_PLAN } from "@zoonk/utils/subscription";

/**
 * The learner's Plus subscription, if they have one. The shared account capability already returns
 * the complete active billing resource, so this only narrows it to Plus, the sole paid plan.
 */
export async function getCurrentPlusSubscription(): Promise<Subscription | null> {
  const activeSubscription = await getActiveSubscription();

  if (activeSubscription?.plan !== PLUS_PLAN.name) {
    return null;
  }

  return activeSubscription;
}
