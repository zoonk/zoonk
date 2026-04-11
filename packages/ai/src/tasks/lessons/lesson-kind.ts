import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ReasoningEffort, buildProviderOptions } from "../../provider-options";
import systemPrompt from "./lesson-kind.prompt.md";

const DEFAULT_MODEL = "openai/gpt-5.4-nano";

const FALLBACK_MODELS = [
  "google/gemini-3.1-flash-lite-preview",
  "meta/llama-4-scout",
  "anthropic/claude-haiku-4.5",
];

const schema = z.object({
  kind: z.enum(["core", "language", "custom"]),
});

export type LessonKindSchema = z.infer<typeof schema>;

export type LessonKindParams = {
  lessonTitle: string;
  lessonDescription: string;
  chapterTitle: string;
  courseTitle: string;
  language: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

export async function generateLessonKind({
  lessonTitle,
  lessonDescription,
  chapterTitle,
  courseTitle,
  language,
  model = DEFAULT_MODEL,
  useFallback = true,
  reasoningEffort,
}: LessonKindParams) {
  const userPrompt = `LESSON_TITLE: ${lessonTitle}
LESSON_DESCRIPTION: ${lessonDescription}
CHAPTER_TITLE: ${chapterTitle}
COURSE_TITLE: ${courseTitle}
LANGUAGE: ${language}`;

  const providerOptions = buildProviderOptions({
    fallbackModels: FALLBACK_MODELS,
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
