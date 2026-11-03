import "server-only";
import { chooseServiceTier } from "@zoonk/ai/provider-options";
import { checkWarmUpCards } from "@zoonk/ai/tasks/warm-up/check-warm-up-cards";
import { WARM_UP_DECK_SIZE } from "@zoonk/ai/tasks/warm-up/warm-up-cards";
import { type WarmUpInput, failWarmUp, holdsWarmUpClaim } from "./claim-warm-up";
import { type writeWarmUp } from "./write-warm-up";

export async function checkWarmUp({
  analytics,
  id,
  input,
  workflowRunId,
  written,
}: {
  analytics?: Parameters<typeof checkWarmUpCards>[0]["analytics"];
  id: string;
  input: WarmUpInput;
  workflowRunId: string;
  written: NonNullable<Awaited<ReturnType<typeof writeWarmUp>>>;
}) {
  if (!(await holdsWarmUpClaim({ id, workflowRunId }))) {
    return null;
  }

  if (written.cards.length < WARM_UP_DECK_SIZE.min) {
    await failWarmUp({ id, workflowRunId });
    return null;
  }

  const checked = await checkWarmUpCards({
    analytics,
    cards: written.cards,
    goal: input.goal,
    kind: input.kind,
    language: input.language,
    serviceTier: chooseServiceTier({ wait: "soon" }),
    writerModel: written.provenance.model,
  });

  return { provenance: checked.provenance, verdicts: checked.data.verdicts };
}
