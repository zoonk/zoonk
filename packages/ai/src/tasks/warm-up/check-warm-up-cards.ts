import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../provider-options";
import { getPromptLanguageName } from "../_utils/prompt-language";
import { selectPromptVariants } from "../_utils/prompt-variants";
import promptTemplate from "./check-warm-up-cards.prompt.md";
import { type WarmUpCard } from "./warm-up-cards";
import { getWarmUpCheckModels } from "./warm-up-check-models";
import { type WarmUpGoalKind } from "./write-warm-up-cards";

const defaultReasoning: Reasoning = "low";

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: the problem before the verdict it leads to. */
const schema = z.object({
  verdicts: z.array(
    z.object({ id: z.string(), problem: z.string().nullable(), keep: z.boolean() }),
  ),
});
/* oxlint-enable eslint/sort-keys */

export type WarmUpCardVerdict = { id: string; keep: boolean; problem: string | null };

export type CheckWarmUpCardsParams = {
  cards: WarmUpCard[];
  goal: string;
  kind: WarmUpGoalKind;
  language: string;
  /** The model that actually wrote the cards, from the writer's provenance. */
  writerModel: string;
  model?: string;
  serviceTier?: ServiceTier;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

function formatCards(cards: readonly WarmUpCard[]): string {
  return JSON.stringify(
    cards.map(({ id, options, question, reveal }) => ({
      id,
      options: options.map(({ correct, text }) => ({ correct, text })),
      question,
      reveal,
    })),
    null,
    1,
  );
}

/** A card the checker skipped is in doubt, so it's dropped. */
function toVerdicts({
  cards,
  verdicts,
}: {
  cards: readonly WarmUpCard[];
  verdicts: readonly WarmUpCardVerdict[];
}): WarmUpCardVerdict[] {
  return cards.map(({ id }) => {
    const answers = verdicts.filter((verdict) => verdict.id === id);
    const dropped = answers.find((verdict) => !verdict.keep);

    if (answers.length > 0 && !dropped) {
      return { id, keep: true, problem: null };
    }

    return {
      id,
      keep: false,
      problem: dropped ? dropped.problem : "The checker returned no verdict for this card.",
    };
  });
}

/** Returns one verdict per card, in the cards' order. */
export async function checkWarmUpCards(params: CheckWarmUpCardsParams) {
  const {
    analytics,
    cards,
    reasoning = defaultReasoning,
    serviceTier,
    useFallback = true,
  } = params;

  const models = getWarmUpCheckModels(params.writerModel);
  const model = params.model ?? models.model;

  const providerOptions = buildProviderOptions({
    fallbackModels: models.fallbackModels.filter((candidate) => candidate !== model),
    model,
    serviceTier,
    useFallback,
  });

  const systemPrompt = selectPromptVariants({
    template: promptTemplate,
    variants: { exam: params.kind === "exam", language: params.kind === "language" },
  });

  const userPrompt = `LANGUAGE: ${getPromptLanguageName({ language: params.language })}

${formatUntrustedInput({ CARDS: formatCards(cards), GOAL: params.goal })}
`;

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions: systemPrompt,
        model,
        output: Output.object({ schema }),
        prompt: userPrompt,
        providerOptions,
        reasoning,
      }),
    libraryInput: true,
    systemPrompt,
    task: "warm-up-check",
  });

  return {
    data: { verdicts: toVerdicts({ cards, verdicts: result.output.verdicts }) },
    provenance,
    systemPrompt,
    usage: result.usage,
    userPrompt,
  };
}
