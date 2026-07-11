import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import { appendLessonRichTextPrompt } from "../_utils/append-lesson-rich-text-prompt";
import baseSystemPrompt from "./lesson-explanation.prompt.md";

const defaultModel = "openai/gpt-5.6-sol";
const fallbackModels = ["anthropic/claude-sonnet-5", "openai/gpt-5.6-luna"] as const;
const systemPrompt = appendLessonRichTextPrompt(baseSystemPrompt);

const anchorSchema = z.object({ text: z.string(), title: z.string().min(1) }).strict();

const explanationStepSchema = z.object({ text: z.string(), title: z.string().min(1) }).strict();

const schema = z
  .object({ anchor: anchorSchema, explanation: z.array(explanationStepSchema).min(1) })
  .strict();

export type LessonExplanationSchema = z.infer<typeof schema>;

export type LessonExplanationParams = {
  lessonTitle: string;
  lessonDescription: string;
  chapterTitle: string;
  courseTitle: string;
  language: string;
  otherLessonTitles: string[];
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

export async function generateLessonExplanation({
  lessonTitle,
  lessonDescription,
  chapterTitle,
  courseTitle,
  language,
  otherLessonTitles,
  model = defaultModel,
  useFallback = true,
  reasoningEffort,
}: LessonExplanationParams) {
  const promptLanguage = getPromptLanguageName({ language });

  const userPrompt = `
    LESSON_TITLE: ${lessonTitle}
    LESSON_DESCRIPTION: ${lessonDescription}
    CHAPTER_TITLE: ${chapterTitle}
    COURSE_TITLE: ${courseTitle}
    LANGUAGE: ${promptLanguage}
    OTHER_EXPLANATION_LESSON_TITLES: ${otherLessonTitles.join(", ")}
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
