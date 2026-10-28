import { googlePlayRenewalWorkflow } from "@/workflows/v2/subscriptions/google-play-renewal-workflow";
import { start } from "workflow/api";

/** Every saved Google Play purchase that still grants Plus is read again at its renewal checkpoint. */
export function scheduleGooglePlayRenewalCheck(input: { checkAt: Date; subscriptionId: string }) {
  return start(googlePlayRenewalWorkflow, [input]);
}
