import { sleep } from "workflow";
import { start } from "workflow/api";
import { claimRunToken } from "../_shared/run-token";
import { checkGooglePlayRenewalStep } from "./steps/check-google-play-renewal-step";

export type GooglePlayRenewalInput = { checkAt: Date; subscriptionId: string };

/**
 * Asks Google about a saved purchase at its renewal checkpoint, so Plus never ends on the stored
 * period alone (`checkGooglePlayRenewal`), then starts the next checkpoint's run, so no run lives
 * for a subscription's whole life. One run per purchase and checkpoint: every save schedules one,
 * and a second start for the same checkpoint ends at once.
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
