import { checkGooglePlayRenewal } from "@zoonk/core/subscriptions/google-play-renewal";

export async function checkGooglePlayRenewalStep(subscriptionId: string): Promise<Date | null> {
  "use step";

  return checkGooglePlayRenewal(subscriptionId);
}
