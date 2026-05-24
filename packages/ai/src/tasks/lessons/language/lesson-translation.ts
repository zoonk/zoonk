import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import { getLanguagePromptContext } from "../../_utils/prompt-language";
import systemPrompt from "./lesson-translation.prompt.md";

const defaultModel = "openai/gpt-5.4";
const fallbackModels = ["google/gemini-3.5-flash", "deepseek/deepseek-v4-pro"] as const;

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
