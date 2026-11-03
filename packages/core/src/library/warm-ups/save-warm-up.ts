import "server-only";
import { WARM_UP_DECK_SIZE } from "@zoonk/ai/tasks/warm-up/warm-up-cards";
import { prisma } from "@zoonk/db";
import { type checkWarmUp } from "./check-warm-up";
import { readWarmUpStatus } from "./claim-warm-up";
import { type writeWarmUp } from "./write-warm-up";

export async function saveWarmUp({
  checked,
  goalId,
  id,
  workflowRunId,
  written,
}: {
  checked: NonNullable<Awaited<ReturnType<typeof checkWarmUp>>>;
  goalId: string;
  id: string;
  workflowRunId: string;
  written: NonNullable<Awaited<ReturnType<typeof writeWarmUp>>>;
}): Promise<string | null> {
  const kept = new Set(checked.verdicts.filter(({ keep }) => keep).map(({ id: cardId }) => cardId));

  // Every app reports a guess by its card's id alone, so the saved id names the deck too.
  const cards = written.cards
    .filter(({ id: cardId }) => kept.has(cardId))
    .slice(0, WARM_UP_DECK_SIZE.max)
    .map((card) => ({ ...card, id: `${id}:${card.id}` }));

  await prisma.warmUp.updateMany({
    data: {
      cards,
      checkerModel: checked.provenance.model,
      promptVersion: written.provenance.promptVersion,
      status: cards.length >= WARM_UP_DECK_SIZE.min ? "ready" : "failed",
      writerModel: written.provenance.model,
    },
    where: { id, runId: workflowRunId, status: "writing" },
  });

  const result = await readWarmUpStatus({ goalId, id });
  return result.status === "ready" ? id : null;
}
