import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { AI_TASK_MODEL_CONFIG } from "@zoonk/ai/tasks/metadata";
import { getLanguageName } from "@zoonk/utils/languages";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatConceptLines } from "../config";
import systemPrompt from "./lesson-grammar-content.prompt.md";

const taskName = "lesson-grammar-content";
const { defaultModel, fallbackModels } = AI_TASK_MODEL_CONFIG[taskName];

const schema = z.object({
  examples: z.array(
    z.object({
      highlight: z.string(),
      sentence: z.string(),
    }),
  ),
  exercises: z.array(
    z.object({
      answer: z.string(),
      distractors: z.array(z.string()),
      template: z.string(),
    }),
  ),
});

export type LessonGrammarContentSchema = z.infer<typeof schema>;

export type LessonGrammarContentParams = {
  chapterTitle: string;
  concepts?: string[];
  lessonDescription: string;
  lessonTitle: string;
  model?: string;
  neighboringConcepts?: string[];
  reasoningEffort?: ReasoningEffort;
  targetLanguage: string;
  useFallback?: boolean;
};

/**
 * Generates the monolingual (TARGET_LANGUAGE only) portion of a grammar lesson.
 * Produces example sentences with highlights and fill-in-the-blank exercises
 * without any translations, romanization, or user-language explanations.
 * Those are added by a separate user content task so the two concerns
 * can run on different models and be cached independently.
 */
export async function generateLessonGrammarContent({
  chapterTitle,
  concepts = [],
  lessonDescription,
  lessonTitle,
  model = defaultModel,
  neighboringConcepts = [],
  reasoningEffort,
  targetLanguage,
  useFallback = true,
}: LessonGrammarContentParams) {
  const targetLanguageName = getLanguageName({ targetLanguage });

  const userPrompt = `
    TARGET_LANGUAGE: ${targetLanguageName}
    CHAPTER_TITLE: ${chapterTitle}
    LESSON_TITLE: ${lessonTitle}
    LESSON_DESCRIPTION: ${lessonDescription}
    ${formatConceptLines(concepts, neighboringConcepts)}
  `;

  const providerOptions = buildProviderOptions({
    fallbackModels,
    model,
    reasoningEffort,
    taskName,
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
