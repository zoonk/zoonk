import "server-only";

import { generateObject } from "ai";
import { z } from "zod";
import systemPrompt from "./prompt.md";

const DEFAULT_MODEL =
  process.env.AI_MODEL_COURSE_DESCRIPTION || "xai/grok-4-fast-reasoning";

const FALLBACK_MODELS = [
  "google/gemini-2.5-flash",
  "openai/gpt-4.1-nano",
  "openai/gpt-oss-120b",
  "meta/llama-4-scout",
];

const schema = z.object({
  description: z.string(),
});

export type CourseDescriptionSchema = z.infer<typeof schema>;

export type CourseDescriptionParams = {
  title: string;
  locale: string;
  model?: string;
  useFallback?: boolean;
};

export async function generateCourseDescription({
  title,
  locale,
  model = DEFAULT_MODEL,
  useFallback = true,
}: CourseDescriptionParams) {
  const userPrompt = `
    COURSE_TITLE: ${title}
    LANGUAGE: ${locale}
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
