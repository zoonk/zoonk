import "server-only";

import { generateText, Output } from "ai";
import { z } from "zod";
import systemPrompt from "./course-chapters.prompt.md";

const DEFAULT_MODEL = process.env.AI_MODEL_COURSE_CHAPTERS ?? "openai/gpt-5.2";

const FALLBACK_MODELS = [
  "openai/gpt-5.1-instant",
  "google/gemini-3-pro-preview",
  "openai/gpt-5",
  "anthropic/claude-opus-4.5",
  "anthropic/claude-sonnet-4.5",
  "openai/gpt-5.1-thinking",
  "openai/gpt-5-mini",
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
  language: string;
  courseTitle: string;
  model?: string;
  useFallback?: boolean;
};

export async function generateCourseChapters({
  language,
  courseTitle,
  model = DEFAULT_MODEL,
  useFallback = true,
}: CourseChaptersParams) {
  const userPrompt = `
    LANGUAGE: ${language}
    COURSE_TITLE: ${courseTitle}
  `;

  const { output, usage } = await generateText({
    model,
    output: Output.object({ schema }),
    prompt: userPrompt,
    providerOptions: {
      gateway: { models: useFallback ? FALLBACK_MODELS : [] },
    },
    system: systemPrompt,
  });

  return { data: output, systemPrompt, usage, userPrompt };
}
