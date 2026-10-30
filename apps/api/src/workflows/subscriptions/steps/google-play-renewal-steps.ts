import {
  checkGooglePlayRenewal,
  findGooglePlayRenewalCheckAt,
} from "@zoonk/core/subscriptions/google-play-renewal";

export async function findGooglePlayRenewalCheckAtStep(subscriptionId: string) {
  "use step";

  return findGooglePlayRenewalCheckAt(subscriptionId);
}

export async function checkGooglePlayRenewalStep(subscriptionId: string) {
  "use step";

  await checkGooglePlayRenewal(subscriptionId);
}
