import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { AI_TASK_MODEL_CONFIG } from "@zoonk/ai/tasks/metadata";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatConceptLines } from "../config";
import { getLanguagePromptContext } from "./_utils/language-prompt-context";
import systemPrompt from "./activity-sentences.prompt.md";

const taskName = "activity-sentences";
const { defaultModel, fallbackModels } = AI_TASK_MODEL_CONFIG[taskName];

const schema = z.object({
  sentences: z.array(
    z.object({
      explanation: z.string(),
      sentence: z.string(),
      translation: z.string(),
    }),
  ),
});

export type ActivitySentencesSchema = z.infer<typeof schema>;

export type ActivitySentencesParams = {
  chapterTitle?: string;
  concepts?: string[];
  lessonDescription?: string;
  lessonTitle: string;
  model?: string;
  neighboringConcepts?: string[];
  reasoningEffort?: ReasoningEffort;
  targetLanguage: string;
  userLanguage: string;
  useFallback?: boolean;
  words: string[];
};

export async function generateActivitySentences({
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
  words,
}: ActivitySentencesParams) {
  const promptContext = getLanguagePromptContext({ targetLanguage, userLanguage });

  const userPrompt = `
    TARGET_LANGUAGE: ${promptContext.targetLanguageName}
    USER_LANGUAGE: ${promptContext.userLanguage}
    CHAPTER_TITLE: ${chapterTitle}
    LESSON_TITLE: ${lessonTitle}
    LESSON_DESCRIPTION: ${lessonDescription}
    VOCABULARY_WORDS: ${words.join(", ")}
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
