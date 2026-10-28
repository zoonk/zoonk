import { sleep } from "workflow";
import { start } from "workflow/api";
import { claimRunToken } from "../_shared/run-token";
import { checkGooglePlayRenewalStep } from "./steps/check-google-play-renewal-step";

export type GooglePlayRenewalInput = { checkAt: Date; subscriptionId: string };

/**
 * One short run per checkpoint, rather than one for a subscription's whole life; every save
 * schedules one, so a second start for the same checkpoint ends at once.
 */
export async function googlePlayRenewalWorkflow(input: GooglePlayRenewalInput) {
  "use workflow";

  using claim = await claimRunToken(
    `google-play-renewal:${input.subscriptionId}:${input.checkAt.toISOString()}`,
  );

  if (claim.conflict) {
    return;
  }

  await sleep(input.checkAt);
  const checkAt = await checkGooglePlayRenewalStep(input.subscriptionId);

  if (checkAt) {
    await start(googlePlayRenewalWorkflow, [{ checkAt, subscriptionId: input.subscriptionId }]);
  }
}
