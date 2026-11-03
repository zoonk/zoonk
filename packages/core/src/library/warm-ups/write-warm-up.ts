import "server-only";
import { chooseServiceTier } from "@zoonk/ai/provider-options";
import { toWarmUpCards } from "@zoonk/ai/tasks/warm-up/warm-up-cards";
import { generateWarmUpCards } from "@zoonk/ai/tasks/warm-up/write-warm-up-cards";
import { type WarmUpInput, holdsWarmUpClaim } from "./claim-warm-up";

export async function writeWarmUp({
  analytics,
  id,
  input,
  workflowRunId,
}: {
  analytics?: Parameters<typeof generateWarmUpCards>[0]["analytics"];
  id: string;
  input: WarmUpInput;
  workflowRunId: string;
}) {
  if (!(await holdsWarmUpClaim({ id, workflowRunId }))) {
    return null;
  }

  const written = await generateWarmUpCards({
    ...input,
    analytics,
    serviceTier: chooseServiceTier({ wait: "soon" }),
  });

  return { cards: toWarmUpCards(written.data.cards), provenance: written.provenance };
}
