import "server-only";

import { generateText, Output } from "ai";
import { z } from "zod";
import systemPrompt from "./course-suggestions.prompt.md";

const DEFAULT_MODEL =
  process.env.AI_MODEL_COURSE_SUGGESTIONS || "google/gemini-3-flash";

const FALLBACK_MODELS = [
  "google/gemini-2.5-flash",
  "xai/grok-4-fast-reasoning",
  "openai/gpt-4.1-mini",
  "moonshotai/kimi-k2",
  "google/gemini-2.5-pro",
];

const schema = z.object({
  courses: z.array(
    z.object({
      description: z.string(),
      title: z.string(),
    }),
  ),
});

export type CourseSuggestionSchema = z.infer<typeof schema>;

export type CourseSuggestionsParams = {
  locale: string;
  prompt: string;
  model?: string;
  useFallback?: boolean;
};

export async function generateCourseSuggestions({
  locale,
  prompt,
  model = DEFAULT_MODEL,
  useFallback = true,
}: CourseSuggestionsParams) {
  const userPrompt = `
    APP_LANGUAGE: ${locale}
    USER_INPUT: ${prompt}
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

  return { data: output.courses, systemPrompt, usage, userPrompt };
}
