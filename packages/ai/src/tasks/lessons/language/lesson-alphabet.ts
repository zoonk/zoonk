import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import { getLanguagePromptContext } from "../../_utils/prompt-language";
import systemPrompt from "./lesson-alphabet.prompt.md";

const defaultModel = "openai/gpt-5.6-sol";
const fallbackModels = ["google/gemini-3.5-flash"] as const;

const formSchema = z.object({ label: z.string(), symbol: z.string() }).strict();
const introSchema = z.object({ text: z.string(), title: z.string() }).strict();

const symbolSchema = z
  .object({
    audioText: z.string(),
    forms: z.array(formSchema),
    pronunciation: z.string(),
    readingAid: z.string(),
    symbol: z.string(),
  })
  .strict();

const schema = z
  .object({ intro: z.array(introSchema), symbols: z.array(symbolSchema).min(1) })
  .strict();

export type LessonAlphabetSchema = z.infer<typeof schema>;

export type LessonAlphabetParams = {
  chapterTitle: string;
  lessonDescription: string;
  lessonTitle: string;
  model?: string;
  reasoningEffort?: ReasoningEffort;
  targetLanguage: string;
  useFallback?: boolean;
  userLanguage: string;
};

/**
 * Generates a complete focused alphabet lesson in one authoring pass.
 *
 * Alphabet lessons now have small lesson-level scopes, so one task can infer the
 * symbol inventory and write the optional short intro without carrying separate
 * topic state through the workflow.
 */
export async function generateLessonAlphabet({
  chapterTitle,
  lessonDescription,
  lessonTitle,
  model = defaultModel,
  reasoningEffort,
  targetLanguage,
  useFallback = true,
  userLanguage,
}: LessonAlphabetParams) {
  const promptContext = getLanguagePromptContext({ targetLanguage, userLanguage });

  const userPrompt = `
    TARGET_LANGUAGE: ${promptContext.targetLanguageName}
    USER_LANGUAGE: ${promptContext.userLanguageName}
    CHAPTER_TITLE: ${chapterTitle}
    LESSON_TITLE: ${lessonTitle}
    LESSON_DESCRIPTION: ${lessonDescription}
  `;

  const providerOptions = buildProviderOptions({
    fallbackModels,
    model,
    reasoningEffort,
    useFallback,
  });

  const { output, usage } = await generateText({
    instructions: systemPrompt,
    model,
    output: Output.object({ schema }),
    prompt: userPrompt,
    providerOptions,
  });

  return { data: output, systemPrompt, usage, userPrompt };
}
