import "server-only";
import { isSameLanguage } from "@zoonk/utils/languages";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../provider-options";
import { getLanguagePromptContext } from "../_utils/prompt-language";
import { selectPromptVariants } from "../_utils/prompt-variants";
import basePrompt from "./check-sentence-orders.prompt.md";

/**
 * In the `check-sentence-orders` eval (343 orders labeled by three model families, three runs each),
 * Sonnet 5.5 kept 0.9% of the wrong orders and dropped 9% of the right ones, at $10.13 per 1k
 * lessons. Opus 5.5 kept 0.2% but dropped 19.5%, German verb-second orders among them, at $18.19.
 * Gemini 4 Argon kept 0.7% and dropped 18.6% at $3.21; Gemini 3.8 Flash kept 2% and dropped 13.2%.
 * GPT-6.2 Sol kept 11.2%, and every smaller model kept more (20 Nov 2026).
 */
const defaultModel = "anthropic/claude-sonnet-5.5";
const fallbackModels = ["google/gemini-4-argon"] as const;

const verdicts = z.array(z.boolean());

const bilingualSchema = z.object({
  sentences: z.array(z.object({ sentenceKeep: verdicts, translationKeep: verdicts })),
});

const sameLanguageSchema = z.object({ sentences: z.array(z.object({ sentenceKeep: verdicts })) });

type SentenceOrdersCheck = {
  sentences: { sentenceKeep: boolean[]; translationKeep?: boolean[] }[];
};

export type CheckSentenceOrdersParams = {
  learnerLanguage: string;
  targetLanguage: string;
  /** In the learner's own language, translation candidates aren't reviewed. */
  sentences: readonly {
    sentence: string;
    translation: string;
    sentenceCandidates: readonly string[];
    translationCandidates: readonly string[];
  }[];
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
  params: CheckSentenceOrdersParams;
  sameLanguage: boolean;
}): string {
  const languages = getLanguagePromptContext({
    targetLanguage: params.targetLanguage,
    userLanguage: params.learnerLanguage,
  });

  const sentences = params.sentences
    .map((item, index) => {
      const sentence = `
    ${index + 1}. sentence: ${item.sentence}`;

      const translation = sameLanguage
        ? ""
        : `
       translation: ${item.translation}`;

      const translationCandidates = sameLanguage
        ? ""
        : `
       translationCandidates: ${JSON.stringify(item.translationCandidates)}`;

      return `${sentence}${translation}
       sentenceCandidates: ${JSON.stringify(item.sentenceCandidates)}${translationCandidates}`;
    })
    .join("");

  const learnerLanguage = sameLanguage
    ? ""
    : `\n    LEARNER_LANGUAGE: ${languages.userLanguageName}`;

  return `
    TARGET_LANGUAGE: ${languages.targetLanguageName}${learnerLanguage}
    SENTENCES:${sentences}
  `;
}

/** Keeps or drops each candidate word order by what a native teacher accepts. */
export async function checkSentenceOrders(params: CheckSentenceOrdersParams) {
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
    task: "check-sentence-orders",
  });

  const data: SentenceOrdersCheck = result.output;

  return { data, provenance, systemPrompt, usage: result.usage, userPrompt };
}
