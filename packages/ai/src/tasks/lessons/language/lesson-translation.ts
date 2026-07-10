import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import { getLanguagePromptContext } from "../../_utils/prompt-language";
import systemPrompt from "./lesson-translation.prompt.md";

const defaultModel = "google/gemini-3.1-flash-lite";

const fallbackModels = [
  "deepseek/deepseek-v4-flash",
  "openai/gpt-5.6-luna",
  "anthropic/claude-haiku-4.5",
] as const;

const schema = z.object({ translation: z.string().min(1) });

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
 * by `generateLessonRomanization` for non-Roman script languages.
 */
export async function generateTranslation({
  model = defaultModel,
  reasoningEffort,
  targetLanguage,
  userLanguage,
  useFallback = true,
  word,
}: TranslationParams) {
  const promptContext = getLanguagePromptContext({ targetLanguage, userLanguage });

  const userPrompt = `
    WORD: ${word}
    TARGET_LANGUAGE: ${promptContext.targetLanguageName}
    USER_LANGUAGE: ${promptContext.userLanguageName}
  `;

  const providerOptions = buildProviderOptions({
    fallbackModels,
    model,
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
