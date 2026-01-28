import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ReasoningEffort, buildProviderOptions } from "../../../provider-options";
import systemPrompt from "./activity-background.prompt.md";

const DEFAULT_MODEL = process.env.AI_MODEL_ACTIVITY_BACKGROUND ?? "openai/gpt-5.2";

const FALLBACK_MODELS = [
  "openai/gpt-5-mini",
  "anthropic/claude-opus-4.5",
  "openai/gpt-5.1-instant",
  "google/gemini-3-flash",
  "google/gemini-3-pro-preview",
];

const schema = z.object({
  steps: z.array(
    z.object({
      text: z.string(),
      title: z.string(),
    }),
  ),
});

export type ActivityBackgroundSchema = z.infer<typeof schema>;

export type ActivityBackgroundParams = {
  lessonTitle: string;
  lessonDescription: string;
  chapterTitle: string;
  courseTitle: string;
  language: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

export async function generateActivityBackground({
  lessonTitle,
  lessonDescription,
  chapterTitle,
  courseTitle,
  language,
  model = DEFAULT_MODEL,
  useFallback = true,
  reasoningEffort,
}: ActivityBackgroundParams) {
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
