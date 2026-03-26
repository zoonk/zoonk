import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import { getLanguagePromptContext } from "./_utils/language-prompt-context";
import systemPrompt from "./activity-word-alternative-translations.prompt.md";

const DEFAULT_MODEL = process.env.AI_MODEL_WORD_ALTERNATIVE_TRANSLATIONS ?? "google/gemini-3-flash";
const FALLBACK_MODELS = ["anthropic/claude-sonnet-4.6", "openai/gpt-5.1-instant"];

const schema = z.object({
  alternativeTranslations: z.array(z.string()),
});

export type WordAlternativeTranslationsSchema = z.infer<typeof schema>;

export type WordAlternativeTranslationsParams = {
  model?: string;
  reasoningEffort?: ReasoningEffort;
  targetLanguage: string;
  translation: string;
  userLanguage: string;
  useFallback?: boolean;
  word: string;
};

/**
 * Generates alternative translations for a single word.
 *
 * Alternative translations prevent semantically equivalent words from
 * appearing as distractors (wrong answer options) in exercises. For example,
 * if "boa noite" translates to "good evening", we mark "good night" as an
 * alternative so it's never shown as a distractor — since it's also correct.
 *
 * This is the canonical source of truth for word-level alternative
 * translation rules. Used by the shared word enrichment step to fill in
 * alternatives for any word (vocabulary or sentence-extracted).
 */
export async function generateWordAlternativeTranslations({
  model = DEFAULT_MODEL,
  reasoningEffort,
  targetLanguage,
  translation,
  userLanguage,
  useFallback = true,
  word,
}: WordAlternativeTranslationsParams) {
  const promptContext = getLanguagePromptContext({ targetLanguage, userLanguage });

  const userPrompt = `WORD: ${word}
TRANSLATION: ${translation}
TARGET_LANGUAGE: ${promptContext.targetLanguageName}
USER_LANGUAGE: ${promptContext.userLanguage}

Identify alternative translations for this word that should also be accepted as correct.`;

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
