import { getActiveSubscription } from "@zoonk/core/auth/subscription";
import { type Subscription } from "@zoonk/db";
import { PLUS_PLAN } from "@zoonk/utils/subscription";

export async function getCurrentPlusSubscription(): Promise<Subscription | null> {
  const activeSubscription = await getActiveSubscription();

  if (activeSubscription?.plan !== PLUS_PLAN.name) {
    return null;
  }

  return activeSubscription;
}
