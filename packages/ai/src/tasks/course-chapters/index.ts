import "server-only";

import { generateObject } from "ai";
import { z } from "zod";
import systemPrompt from "./prompt.md";

const DEFAULT_MODEL =
  process.env.AI_MODEL_COURSE_CHAPTERS ?? "openai/gpt-5.1-instant";

const FALLBACK_MODELS = [
  "openai/gpt-5.1-thinking",
  "google/gemini-2.5-pro",
  "anthropic/claude-sonnet-4.5",
  "xai/grok-4-fast-reasoning",
];

const schema = z.object({
  chapters: z.array(
    z.object({
      description: z.string(),
      title: z.string(),
    }),
  ),
});

export type CourseChaptersSchema = z.infer<typeof schema>;

export type CourseChaptersParams = {
  locale: string;
  courseTitle: string;
  model?: string;
  useFallback?: boolean;
};

export async function generateCourseChapters({
  locale,
  courseTitle,
  model = DEFAULT_MODEL,
  useFallback = true,
}: CourseChaptersParams) {
  const userPrompt = `
    LANGUAGE: ${locale}
    COURSE_TITLE: ${courseTitle}
  `;

  const { object, usage } = await generateObject({
    model,
    prompt: userPrompt,
    providerOptions: {
      gateway: { models: useFallback ? FALLBACK_MODELS : [] },
    },
    schema,
    system: systemPrompt,
  });

  return { data: object, systemPrompt, usage, userPrompt };
}
