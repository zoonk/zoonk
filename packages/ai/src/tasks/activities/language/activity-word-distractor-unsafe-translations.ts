import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import { getLanguagePromptContext } from "./_utils/language-prompt-context";
import systemPrompt from "./activity-word-distractor-unsafe-translations.prompt.md";

const DEFAULT_MODEL =
  process.env.AI_MODEL_WORD_DISTRACTOR_UNSAFE_TRANSLATIONS ?? "google/gemini-3-flash";
const FALLBACK_MODELS = ["anthropic/claude-sonnet-4.6", "openai/gpt-5.1-instant"];

const schema = z.object({
  distractorUnsafeTranslations: z.array(z.string()),
});

export type WordDistractorUnsafeTranslationsSchema = z.infer<typeof schema>;

export type WordDistractorUnsafeTranslationsParams = {
  model?: string;
  reasoningEffort?: ReasoningEffort;
  targetLanguage: string;
  translation: string;
  userLanguage: string;
  useFallback?: boolean;
  word: string;
};

/**
 * Generates distractor-unsafe translations for a single word.
 *
 * Distractor-unsafe translations are extra learner-language phrases that would
 * make a multiple-choice option misleading. For example, if "boa noite"
 * translates to "good evening", we also store "good night" so we never show it
 * as a distractor.
 *
 * This is the canonical source of truth for word-level distractor filtering.
 * The shared pronunciation step uses it to fill in distractorUnsafeTranslations
 * for any word we surface in activities.
 */
export async function generateWordDistractorUnsafeTranslations({
  model = DEFAULT_MODEL,
  reasoningEffort,
  targetLanguage,
  translation,
  userLanguage,
  useFallback = true,
  word,
}: WordDistractorUnsafeTranslationsParams) {
  const promptContext = getLanguagePromptContext({ targetLanguage, userLanguage });

  const userPrompt = `WORD: ${word}
TRANSLATION: ${translation}
TARGET_LANGUAGE: ${promptContext.targetLanguageName}
USER_LANGUAGE: ${promptContext.userLanguage}

List learner-language translations that would make distractors misleading for this word.`;

  const providerOptions = buildProviderOptions({
    fallbackModels: FALLBACK_MODELS,
    reasoningEffort,
    useFallback,
  });

  const { output, usage } = await generateText({
    model,
    output: Output.object({ schema }),
    prompt: userPrompt,
    providerOptions,
    system: systemPrompt,
  });

  return { data: output, systemPrompt, usage, userPrompt };
}
