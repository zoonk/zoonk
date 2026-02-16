import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import { getLanguagePromptContext } from "./_utils/language-prompt-context";
import systemPrompt from "./activity-vocabulary.prompt.md";

const DEFAULT_MODEL = process.env.AI_MODEL_ACTIVITY_VOCABULARY ?? "google/gemini-3-flash";

const FALLBACK_MODELS = [
  "openai/gpt-5.2",
  "openai/gpt-5-mini",
  "anthropic/claude-opus-4.5",
  "google/gemini-3-pro-preview",
];

const schema = z.object({
  words: z.array(
    z.object({
      alternativeTranslations: z.array(z.string()),
      romanization: z.string().nullable(),
      translation: z.string(),
      word: z.string(),
    }),
  ),
});

export type ActivityVocabularySchema = z.infer<typeof schema>;

export type ActivityVocabularyParams = {
  chapterTitle: string;
  lessonDescription: string;
  lessonTitle: string;
  model?: string;
  reasoningEffort?: ReasoningEffort;
  targetLanguage: string;
  userLanguage: string;
  useFallback?: boolean;
};

export async function generateActivityVocabulary({
  chapterTitle,
  lessonDescription,
  lessonTitle,
  model = DEFAULT_MODEL,
  reasoningEffort,
  targetLanguage,
  userLanguage,
  useFallback = true,
}: ActivityVocabularyParams) {
  const promptContext = getLanguagePromptContext({ targetLanguage, userLanguage });

  const userPrompt = `TARGET_LANGUAGE: ${promptContext.targetLanguageName}
USER_LANGUAGE: ${promptContext.userLanguage}
CHAPTER_TITLE: ${chapterTitle}
LESSON_TITLE: ${lessonTitle}
LESSON_DESCRIPTION: ${lessonDescription}

Generate a focused, representative vocabulary list for this language lesson. Include essential words for this specific topic - quality over quantity.`;

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
