import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { buildProviderOptions, type ReasoningEffort } from "../../types";
import systemPrompt from "./lesson-kind.prompt.md";

const DEFAULT_MODEL = process.env.AI_MODEL_LESSON_KIND ?? "google/gemini-2.5-flash-lite";

const FALLBACK_MODELS = [
  "meta/llama-4-scout",
  "xai/grok-4-fast-non-reasoning",
  "openai/gpt-4.1-nano",
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
