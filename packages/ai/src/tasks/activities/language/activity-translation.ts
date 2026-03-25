import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import { getLanguagePromptContext } from "./_utils/language-prompt-context";
import systemPrompt from "./activity-translation.prompt.md";

const DEFAULT_MODEL = process.env.AI_MODEL_TRANSLATION ?? "openai/gpt-5.4-mini";
const FALLBACK_MODELS = ["google/gemini-3-flash", "anthropic/claude-opus-4.6"];

const schema = z.object({
  translation: z.string(),
});

export type TranslationSchema = z.infer<typeof schema>;

export type TranslationParams = {
  model?: string;
  reasoningEffort?: ReasoningEffort;
  targetLanguage: string;
  userLanguage: string;
  useFallback?: boolean;
  word: string;
};

/**
 * Translates a single word from the target language into the user's native language.
 * Returns just the translation — romanization is handled separately
 * by `generateActivityRomanization` for non-Roman script languages.
 */
export async function generateTranslation({
  model = DEFAULT_MODEL,
  reasoningEffort,
  targetLanguage,
  userLanguage,
  useFallback = true,
  word,
}: TranslationParams) {
  const promptContext = getLanguagePromptContext({ targetLanguage, userLanguage });

  const userPrompt = `WORD: ${word}
TARGET_LANGUAGE: ${promptContext.targetLanguageName}
USER_LANGUAGE: ${promptContext.userLanguage}`;

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
