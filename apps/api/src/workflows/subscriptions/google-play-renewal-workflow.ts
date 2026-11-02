import { sleep } from "workflow";
import { start } from "workflow/api";
import { claimRunToken } from "../_shared/run-token";
import {
  checkGooglePlayRenewalStep,
  findGooglePlayRenewalCheckAtStep,
} from "./steps/google-play-renewal-steps";

/**
 * One live run per subscription row, so checks can't fork: it sleeps to the checkpoint the row
 * gives, checks, and hands the row's token to a run on the latest deployment, so a credentials fix
 * reaches the next check. A check that fails leaves the row as it was, so the same rule picks the
 * next checkpoint. Returns the next run's id, or null once the row needs no more checks.
 */
export async function googlePlayRenewalWorkflow(subscriptionId: string): Promise<string | null> {
  "use workflow";

  {
    using claim = await claimRunToken(`google-play-renewal:${subscriptionId}`);

    if (claim.conflict) {
      return null;
    }

    const checkAt = await findGooglePlayRenewalCheckAtStep(subscriptionId);

    if (!checkAt) {
      return null;
    }

    await sleep(checkAt);
    await checkGooglePlayRenewalStep(subscriptionId).catch(() => null);

    if (!(await findGooglePlayRenewalCheckAtStep(subscriptionId))) {
      return null;
    }
  }

  const next = await start(googlePlayRenewalWorkflow, [subscriptionId], { deploymentId: "latest" });

  return next.runId;
}
