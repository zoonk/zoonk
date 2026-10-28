import { GooglePlayError } from "@zoonk/core/subscriptions/google-play-error";
import { checkGooglePlayRenewal } from "@zoonk/core/subscriptions/google-play-renewal";
import { RetryableError } from "workflow";

/** Google being unreachable must not end access, so the check retries hourly for a day. */
export async function checkGooglePlayRenewalStep(subscriptionId: string): Promise<Date | null> {
  "use step";

  try {
    return await checkGooglePlayRenewal(subscriptionId);
  } catch (error) {
    if (
      error instanceof GooglePlayError &&
      (error.reason === "unavailable" || error.reason === "configuration")
    ) {
      throw new RetryableError("Google Play is unavailable; checking again in an hour.", {
        retryAfter: "1h",
      });
    }

    throw error;
  }
}

checkGooglePlayRenewalStep.maxRetries = 24;
