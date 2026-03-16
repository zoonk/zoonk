import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import { getLanguagePromptContext } from "./_utils/language-prompt-context";
import systemPrompt from "./activity-sentence-word-translation.prompt.md";

const DEFAULT_MODEL = process.env.AI_MODEL_SENTENCE_WORD_TRANSLATION ?? "openai/gpt-5.1-instant";
const FALLBACK_MODELS = ["google/gemini-3-flash", "anthropic/claude-opus-4.6"];

const schema = z.object({
  romanization: z.string().nullable(),
  translation: z.string(),
});

export type SentenceWordTranslationSchema = z.infer<typeof schema>;

export type SentenceWordTranslationParams = {
  model?: string;
  reasoningEffort?: ReasoningEffort;
  targetLanguage: string;
  userLanguage: string;
  useFallback?: boolean;
  word: string;
};

export async function generateSentenceWordTranslation({
  model = DEFAULT_MODEL,
  reasoningEffort,
  targetLanguage,
  userLanguage,
  useFallback = true,
  word,
}: SentenceWordTranslationParams) {
  const promptContext = getLanguagePromptContext({ targetLanguage, userLanguage });

  const userPrompt = `WORD: ${word}
TARGET_LANGUAGE: ${promptContext.targetLanguageName}
USER_LANGUAGE: ${promptContext.userLanguage}

Translate this word and provide romanization if applicable.`;

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
