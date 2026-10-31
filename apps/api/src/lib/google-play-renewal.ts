import { googlePlayRenewalWorkflow } from "@/workflows/subscriptions/google-play-renewal-workflow";
import { start } from "workflow/api";

export function scheduleGooglePlayRenewalCheck(subscriptionId: string) {
  return start(googlePlayRenewalWorkflow, [subscriptionId]);
}
