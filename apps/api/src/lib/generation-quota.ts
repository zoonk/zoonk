import {
  type GenerationRateLimitTarget,
  trackGenerationRateLimited,
} from "@/lib/server-track-events";
import { claimGenerationQuotaIfNeeded as claimCoreGenerationQuotaIfNeeded } from "@zoonk/core/generation-quotas/claim";

type GenerationQuotaInput = Parameters<typeof claimCoreGenerationQuotaIfNeeded>[0] & {
  target: GenerationRateLimitTarget;
};

/** Keeps quota accounting in Core while recording rejected API work with delivery-layer target metadata. */
export async function claimGenerationQuotaIfNeeded({ target, ...input }: GenerationQuotaInput) {
  const result = await claimCoreGenerationQuotaIfNeeded(input);

  if (result.status === "limitReached") {
    await trackGenerationRateLimited({ actor: result.actor, limit: result.limit, target });
  }

  return result;
}
