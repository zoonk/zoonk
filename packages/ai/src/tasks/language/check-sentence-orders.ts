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
 * No fallback: reviewing Terra's candidates, other providers' models kept 5 to 13 times more wrong
 * orders (7 Nov 2026), and a failed review only leaves the lesson owing its orders for a later run.
 */
const defaultModel = "google/gemini-4-argon";

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

  const providerOptions = buildProviderOptions({
    fallbackModels: [],
    model,
    serviceTier,
    useFallback,
  });

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
