import "server-only";
import { type Reasoning, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import { getLanguagePromptContext } from "../../_utils/prompt-language";
import systemPrompt from "./lesson-vocabulary.prompt.md";

const defaultModel = "google/gemini-3.5-flash";
const fallbackModels = ["openai/gpt-5.5"] as const;

const wordSchema = z.object({ translation: z.string(), word: z.string() });

const schema = z.object({ words: z.array(wordSchema).min(1) });

export type LessonVocabularySchema = z.infer<typeof schema>;
export type VocabularyWord = LessonVocabularySchema["words"][number];

export type LessonVocabularyParams = {
  chapterTitle: string;
  lessonDescription: string;
  lessonTitle: string;
  model?: string;
  reasoning?: Reasoning;
  targetLanguage: string;
  userLanguage: string;
  useFallback?: boolean;
};

/**
 * Generates vocabulary from the lesson plan metadata so the lesson row remains
 * the single source of truth for generation scope.
 */
export async function generateLessonVocabulary({
  chapterTitle,
  lessonDescription,
  lessonTitle,
  model = defaultModel,
  reasoning,
  targetLanguage,
  userLanguage,
  useFallback = true,
}: LessonVocabularyParams) {
  const promptContext = getLanguagePromptContext({ targetLanguage, userLanguage });

  const userPrompt = `
    TARGET_LANGUAGE: ${promptContext.targetLanguageName}
    USER_LANGUAGE: ${promptContext.userLanguageName}
    CHAPTER_TITLE: ${chapterTitle}
    LESSON_TITLE: ${lessonTitle}
    LESSON_DESCRIPTION: ${lessonDescription}
  `;

  const providerOptions = buildProviderOptions({ fallbackModels, model, useFallback });

  const { output, usage } = await generateText({
    model,
    output: Output.object({ schema }),
    prompt: userPrompt,
    providerOptions,
    reasoning,
    system: systemPrompt,
  });

  return { data: output, systemPrompt, usage, userPrompt };
}
