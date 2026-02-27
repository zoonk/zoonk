import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import systemPrompt from "./activity-custom.prompt.md";

const DEFAULT_MODEL = process.env.AI_MODEL_ACTIVITY_CUSTOM ?? "openai/gpt-5.2";

const FALLBACK_MODELS = [
  "openai/gpt-5-mini",
  "google/gemini-3.1-pro-preview",
  "anthropic/claude-opus-4.5",
  "anthropic/claude-sonnet-4.5",
  "google/gemini-3.1-pro-preview",
];

const schema = z.object({
  steps: z.array(
    z.object({
      text: z.string(),
      title: z.string(),
    }),
  ),
});

export type ActivityCustomSchema = z.infer<typeof schema>;

export type ActivityCustomParams = {
  lessonTitle: string;
  lessonDescription: string;
  chapterTitle: string;
  courseTitle: string;
  language: string;
  activityTitle: string;
  activityDescription: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

export async function generateActivityCustom({
  lessonTitle,
  lessonDescription,
  chapterTitle,
  courseTitle,
  language,
  activityTitle,
  activityDescription,
  model = DEFAULT_MODEL,
  useFallback = true,
  reasoningEffort,
}: ActivityCustomParams) {
  const userPrompt = `LESSON_TITLE: ${lessonTitle}
LESSON_DESCRIPTION: ${lessonDescription}
CHAPTER_TITLE: ${chapterTitle}
COURSE_TITLE: ${courseTitle}
LANGUAGE: ${language}
ACTIVITY_TITLE: ${activityTitle}
ACTIVITY_DESCRIPTION: ${activityDescription}`;

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
