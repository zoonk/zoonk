import "server-only";
import { isSameLanguage } from "@zoonk/utils/languages";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../provider-options";
import { getLanguagePromptContext } from "../_utils/prompt-language";
import { selectPromptVariants } from "../_utils/prompt-variants";
import basePrompt from "./language-sentence-orders.prompt.md";

/**
 * Finds candidates generously, since `checkSentenceOrders` reviews each one. Over 12 lessons Terra
 * found every right order any other generator found; Gemini 4 Argon, the best from another
 * provider, found 91% (8 Nov 2026).
 */
const defaultModel = "openai/gpt-6.1-terra";
const fallbackModels = ["google/gemini-4-argon"] as const;

const orders = z.array(z.string());

const bilingualSchema = z.object({
  sentences: z.array(z.object({ otherOrders: orders, otherTranslationOrders: orders })),
});

/** A learner reading the app in the language they learn builds the sentence itself both ways. */
const sameLanguageSchema = z.object({ sentences: z.array(z.object({ otherOrders: orders })) });

export type LanguageSentenceOrders = {
  sentences: { otherOrders: string[]; otherTranslationOrders?: string[] }[];
};

export type LanguageSentenceOrdersParams = {
  learnerLanguage: string;
  targetLanguage: string;
  sentences: readonly { sentence: string; translation: string }[];
  model?: string;
  serviceTier?: ServiceTier;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

function buildUserPrompt({
  params,
  sameLanguage,
}: {
  params: LanguageSentenceOrdersParams;
  sameLanguage: boolean;
}): string {
  const languages = getLanguagePromptContext({
    targetLanguage: params.targetLanguage,
    userLanguage: params.learnerLanguage,
  });

  const sentences = params.sentences
    .map((item, index) =>
      sameLanguage
        ? `
    ${index + 1}. sentence: ${item.sentence}`
        : `
    ${index + 1}. sentence: ${item.sentence}
       translation: ${item.translation}`,
    )
    .join("");

  const learnerLanguage = sameLanguage
    ? ""
    : `\n    LEARNER_LANGUAGE: ${languages.userLanguageName}`;

  return `
    TARGET_LANGUAGE: ${languages.targetLanguageName}${learnerLanguage}
    SENTENCES:${sentences}
  `;
}

/** Candidate other word orders for a lesson's sentences and their translations. */
export async function generateLanguageSentenceOrders(params: LanguageSentenceOrdersParams) {
  const { analytics, model = defaultModel, reasoning, serviceTier, useFallback = true } = params;
  const sameLanguage = isSameLanguage(params);

  const systemPrompt = selectPromptVariants({
    template: basePrompt,
    variants: { bilingual: !sameLanguage, sameLanguage },
  });

  const userPrompt = buildUserPrompt({ params, sameLanguage });
  const providerOptions = buildProviderOptions({ fallbackModels, model, serviceTier, useFallback });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions: systemPrompt,
        model,
        output: Output.object({ schema: sameLanguage ? sameLanguageSchema : bilingualSchema }),
        prompt: userPrompt,
        providerOptions,
        reasoning,
      }),
    libraryInput: true,
    systemPrompt,
    task: "language-sentence-orders",
  });

  const data: LanguageSentenceOrders = result.output;

  return { data, provenance, systemPrompt, usage: result.usage, userPrompt };
}
