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
import { withSentenceOrdersRule } from "./sentence-orders-rule";

/** Judges orders by the rule the lesson writer follows, so it runs on the lesson writer's models. */
const defaultModel = "openai/gpt-6.1-terra";
const fallbackModels = ["google/gemini-3.8-flash"] as const;

const schema = z.object({
  sentences: z.array(
    z.object({ otherOrders: z.array(z.string()), otherTranslationOrders: z.array(z.string()) }),
  ),
});

export type LanguageSentenceOrders = z.infer<typeof schema>;

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

function getSystemPrompt(
  languages: Pick<LanguageSentenceOrdersParams, "learnerLanguage" | "targetLanguage">,
): string {
  const sameLanguage = isSameLanguage(languages);

  return selectPromptVariants({
    template: withSentenceOrdersRule(basePrompt),
    variants: { bilingual: !sameLanguage, sameLanguage },
  });
}

function buildUserPrompt(params: LanguageSentenceOrdersParams): string {
  const languages = getLanguagePromptContext({
    targetLanguage: params.targetLanguage,
    userLanguage: params.learnerLanguage,
  });

  const sentences = params.sentences
    .map(
      (item, index) => `
    ${index + 1}. sentence: ${item.sentence}
       translation: ${item.translation}`,
    )
    .join("");

  return `
    TARGET_LANGUAGE: ${languages.targetLanguageName}
    LEARNER_LANGUAGE: ${languages.userLanguageName}
    SENTENCES:${sentences}
  `;
}

/** Other word orders for sentences written before lessons had them. */
export async function generateLanguageSentenceOrders(params: LanguageSentenceOrdersParams) {
  const { analytics, model = defaultModel, reasoning, serviceTier, useFallback = true } = params;
  const systemPrompt = getSystemPrompt(params);
  const userPrompt = buildUserPrompt(params);
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
    task: "language-sentence-orders",
  });

  return { data: result.output, provenance, systemPrompt, usage: result.usage, userPrompt };
}
