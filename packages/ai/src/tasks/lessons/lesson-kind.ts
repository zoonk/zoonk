import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type Reasoning, buildProviderOptions } from "../../provider-options";
import { getPromptLanguageName } from "../_utils/prompt-language";
import systemPrompt from "./lesson-kind.prompt.md";

const defaultModel = "openai/gpt-5.4-nano";

const fallbackModels = [
  "google/gemini-3.1-flash-lite",
  "meta/llama-4-scout",
  "anthropic/claude-haiku-4.5",
] as const;

const schema = z.object({ kind: z.enum(["explanation", "tutorial"]) });

export type LessonKindSchema = z.infer<typeof schema>;

type LessonKindParams = {
  chapterTitle: string;
  courseTitle: string;
  language: string;
  lessonDescription: string;
  lessonTitle: string;
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
};

/**
 * Classifying one lesson at a time lets chapter generation classify all planned
 * lessons in parallel while keeping the AI task focused on the specific lesson
 * title and description.
 */
export async function generateLessonKind({
  chapterTitle,
  courseTitle,
  language,
  lessonDescription,
  lessonTitle,
  model = defaultModel,
  useFallback = true,
  reasoning,
}: LessonKindParams) {
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
    model,
    output: Output.object({ schema }),
    prompt: userPrompt,
    providerOptions,
    reasoning,
    system: systemPrompt,
  });

  return { data: output, systemPrompt, usage, userPrompt };
}
