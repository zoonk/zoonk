import "server-only";
import { chooseServiceTier } from "@zoonk/ai/provider-options";
import { solveItems } from "@zoonk/ai/tasks/items/solve";
import { findKeyMismatch } from "../items/key-mismatch";
import { type checkWarmUp } from "./check-warm-up";
import { holdsWarmUpClaim } from "./claim-warm-up";

export async function checkWarmUpKeys({
  analytics,
  id,
  workflowRunId,
  written,
}: Parameters<typeof checkWarmUp>[0]) {
  if (!(await holdsWarmUpClaim({ id, workflowRunId }))) {
    return null;
  }

  const items = written.cards.map((card) => ({
    context: null,
    difficulty: "easy" as const,
    fixedOrder: true,
    format: "multipleChoice" as const,
    image: null,
    options: card.options.map(({ correct, text }) => ({
      isCorrect: correct,
      misconception: null,
      reason: card.reveal,
      text,
    })),
    question: card.question,
    visual: null,
  }));

  const { data } = await solveItems({
    analytics,
    items,
    select: 1,
    serviceTier: chooseServiceTier({ wait: "learner" }),
  });

  return {
    ...written,
    cards: written.cards.filter((_, index) => {
      const item = items[index];
      return item && findKeyMismatch({ item, solution: data.solutions[index] ?? null }) === null;
    }),
  };
}
