import "server-only";
import { type Reasoning, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import { appendLessonRichTextPrompt } from "../_utils/append-lesson-rich-text-prompt";
import baseSystemPrompt from "./lesson-tutorial.prompt.md";

const defaultModel = "anthropic/claude-fable-5";
const fallbackModels = ["openai/gpt-5.6-sol", "google/gemini-3.5-flash"] as const;
const systemPrompt = appendLessonRichTextPrompt(baseSystemPrompt);

const stepSchema = z.object({ text: z.string(), title: z.string() });

const schema = z.object({ steps: z.array(stepSchema).min(1) });

export type LessonTutorialSchema = z.infer<typeof schema>;

export type LessonTutorialParams = {
  lessonTitle: string;
  lessonDescription: string;
  chapterTitle: string;
  courseTitle: string;
  language: string;
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
};

export async function generateLessonTutorial({
  lessonTitle,
  lessonDescription,
  chapterTitle,
  courseTitle,
  language,
  model = defaultModel,
  useFallback = true,
  reasoning,
}: LessonTutorialParams) {
  const promptLanguage = getPromptLanguageName({ language });

  const userPrompt = `
    LESSON_TITLE: ${lessonTitle}
    LESSON_DESCRIPTION: ${lessonDescription}
    CHAPTER_TITLE: ${chapterTitle}
    COURSE_TITLE: ${courseTitle}
    LANGUAGE: ${promptLanguage}
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
