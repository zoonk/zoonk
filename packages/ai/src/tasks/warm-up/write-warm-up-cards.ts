import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../provider-options";
import { formatLocalContext } from "../_utils/language-context";
import { getPromptLanguageName } from "../_utils/prompt-language";
import { selectPromptVariants } from "../_utils/prompt-variants";
import { rawWarmUpCardSchema } from "./warm-up-cards";
import promptTemplate from "./write-warm-up-cards.prompt.md";

/**
 * Luna scored 8.59 on the warm-up-cards eval at 13 s p50 (3 Nov 2026), reading about 1,700 tokens
 * and writing 1,300 for $0.0008 a deck. On four cases with an earlier prompt it scored 7.75, ahead
 * of Gemini 3.8 Flash (7.03), Flash Lite (6.82, 5 s) and Haiku (6.76, 72 s), so the fast Flash
 * Lite falls back first.
 */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.5-flash-lite", "anthropic/claude-haiku-5.5"] as const;
const defaultReasoning: Reasoning = "low";

const schema = z.object({ cards: z.array(rawWarmUpCardSchema) });

export type WarmUpGoalKind = "exam" | "language" | "learn";

export type WriteWarmUpCardsParams = {
  /** The goal's general form, never the learner's words: the deck is shared. */
  goal: string;
  kind: WarmUpGoalKind;
  language: string;
  /** An exam's subject areas, named by its public blueprint. */
  subjects?: string[];
  targetLanguage?: string;
  model?: string;
  serviceTier?: ServiceTier;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

function formatTargetLanguage({ language, targetLanguage }: WriteWarmUpCardsParams): string {
  return targetLanguage
    ? getPromptLanguageName({ language: targetLanguage, userLanguage: language })
    : "the one GOAL names";
}

function formatInputs(params: WriteWarmUpCardsParams): string {
  return [
    `LANGUAGE: ${getPromptLanguageName({ language: params.language })}`,
    params.kind === "language" && `TARGET_LANGUAGE: ${formatTargetLanguage(params)}`,
    params.kind === "exam" && `SUBJECTS: ${params.subjects?.join("; ") || "none"}`,
    formatLocalContext(params.language),
  ]
    .filter(Boolean)
    .join("\n");
}

export async function generateWarmUpCards(params: WriteWarmUpCardsParams) {
  const {
    analytics,
    model = defaultModel,
    reasoning = defaultReasoning,
    serviceTier,
    useFallback = true,
  } = params;

  const systemPrompt = selectPromptVariants({
    template: promptTemplate,
    variants: {
      exam: params.kind === "exam",
      language: params.kind === "language",
      learn: params.kind === "learn",
    },
  });

  const userPrompt = `${formatInputs(params)}\n\n${formatUntrustedInput({ GOAL: params.goal })}\n`;
  const providerOptions = buildProviderOptions({ fallbackModels, model, serviceTier, useFallback });

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
    task: "warm-up-cards",
  });

  return {
    data: { cards: result.output.cards },
    provenance,
    systemPrompt,
    usage: result.usage,
    userPrompt,
  };
}
