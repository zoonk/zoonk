import { randomUUID } from "node:crypto";
import { claimGenerationQuotaIfNeeded } from "../../generation-quotas/claim-generation-quota";

/** Limits daily AI operations, without imposing a lifetime limit on discovery questions. */
export function claimLearningRequestQuota() {
  return claimGenerationQuotaIfNeeded({
    resource: "learningRequest",
    shouldClaimQuota: true,
    targetId: randomUUID(),
  });
}
