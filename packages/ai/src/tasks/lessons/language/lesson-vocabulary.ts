import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import { getLanguagePromptContext } from "../../_utils/prompt-language";
import { formatConceptLines } from "../config";
import systemPrompt from "./lesson-vocabulary.prompt.md";

const defaultModel = "google/gemini-3-flash";
const fallbackModels = ["google/gemini-3.1-pro-preview", "openai/gpt-5.5"] as const;

const wordSchema = z.object({ translation: z.string(), word: z.string() });

const schema = z.object({ words: z.array(wordSchema).min(1) });

export type LessonVocabularySchema = z.infer<typeof schema>;
export type VocabularyWord = LessonVocabularySchema["words"][number];

export type LessonVocabularyParams = {
  chapterTitle: string;
  concepts?: string[];
  lessonDescription: string;
  lessonTitle: string;
  model?: string;
  neighboringConcepts?: string[];
  reasoningEffort?: ReasoningEffort;
  targetLanguage: string;
  userLanguage: string;
  useFallback?: boolean;
};

export async function generateLessonVocabulary({
  chapterTitle,
  concepts = [],
  lessonDescription,
  lessonTitle,
  model = defaultModel,
  neighboringConcepts = [],
  reasoningEffort,
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
    ${formatConceptLines(concepts, neighboringConcepts)}
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
