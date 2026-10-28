import { googlePlayRenewalWorkflow } from "@/workflows/v2/subscriptions/google-play-renewal-workflow";
import { start } from "workflow/api";

export function scheduleGooglePlayRenewalCheck(input: { checkAt: Date; subscriptionId: string }) {
  return start(googlePlayRenewalWorkflow, [input]);
}
