import "server-only";
import { type Reasoning, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import { getLanguagePromptContext } from "../../_utils/prompt-language";
import { type SourceLesson, formatSourceLessonsForPrompt } from "../_utils/source-lessons";
import systemPrompt from "./lesson-sentences.prompt.md";

const defaultModel = "openai/gpt-5.5";
const fallbackModels = ["google/gemini-3.5-flash", "openai/gpt-5.6-sol"] as const;

const sentenceSchema = z.object({
  explanation: z.string(),
  sentence: z.string(),
  translation: z.string(),
});

const schema = z.object({ sentences: z.array(sentenceSchema).min(1) });

export type LessonSentencesSchema = z.infer<typeof schema>;

export type LessonSentencesParams = {
  chapterTitle?: string;
  lessonDescription?: string;
  lessonTitle: string;
  model?: string;
  reasoning?: Reasoning;
  sourceLessons: SourceLesson[];
  targetLanguage: string;
  userLanguage: string;
  useFallback?: boolean;
};

/**
 * Generates reading practice sentences from planned lesson metadata so reading
 * lessons do not need to wait for vocabulary content from another workflow.
 */
export async function generateLessonSentences({
  chapterTitle,
  lessonDescription,
  lessonTitle,
  model = defaultModel,
  reasoning,
  sourceLessons,
  targetLanguage,
  userLanguage,
  useFallback = true,
}: LessonSentencesParams) {
  const promptContext = getLanguagePromptContext({ targetLanguage, userLanguage });

  const userPrompt = `
    TARGET_LANGUAGE: ${promptContext.targetLanguageName}
    USER_LANGUAGE: ${promptContext.userLanguageName}
    CHAPTER_TITLE: ${chapterTitle}
    LESSON_TITLE: ${lessonTitle}
    LESSON_DESCRIPTION: ${lessonDescription}
    SOURCE_LESSONS: ${formatSourceLessonsForPrompt(sourceLessons)}
  `;

  const providerOptions = buildProviderOptions({ fallbackModels, model, useFallback });

  const { output, usage } = await generateText({
    instructions: systemPrompt,
    model,
    output: Output.object({ schema }),
    prompt: userPrompt,
    providerOptions,
    reasoning,
  });

  return { data: output, systemPrompt, usage, userPrompt };
}
