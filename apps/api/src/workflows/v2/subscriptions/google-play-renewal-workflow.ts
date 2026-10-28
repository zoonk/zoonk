import { sleep } from "workflow";
import { start } from "workflow/api";
import { claimRunToken } from "../_shared/run-token";
import { checkGooglePlayRenewalStep } from "./steps/check-google-play-renewal-step";

const RETRY_AFTER_MS = 86_400_000;

export type GooglePlayRenewalInput = { checkAt: Date; subscriptionId: string };

/**
 * One short run per checkpoint, rather than one for a subscription's whole life; every save
 * schedules one, so a second start for the same checkpoint ends at once. A check that keeps failing
 * (Google down, broken credentials) hands off to a run a day later, on the latest deployment so a
 * fix reaches it, until Google answers. Returns the next run's id.
 */
export async function googlePlayRenewalWorkflow(
  input: GooglePlayRenewalInput,
): Promise<string | null> {
  "use workflow";

  using claim = await claimRunToken(
    `google-play-renewal:${input.subscriptionId}:${input.checkAt.toISOString()}`,
  );

  if (claim.conflict) {
    return null;
  }

  await sleep(input.checkAt);

  const checkAt = await checkGooglePlayRenewalStep(input.subscriptionId).catch(
    () => new Date(Date.now() + RETRY_AFTER_MS),
  );

  if (!checkAt) {
    return null;
  }

  const next = await start(
    googlePlayRenewalWorkflow,
    [{ checkAt, subscriptionId: input.subscriptionId }],
    { deploymentId: "latest" },
  );

  return next.runId;
}
