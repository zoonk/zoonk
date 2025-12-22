import "server-only";

import { generateText, Output } from "ai";
import { z } from "zod";
import systemPrompt from "./prompt.md";

const DEFAULT_MODEL =
  process.env.AI_MODEL_COURSE_CATEGORIES ?? "google/gemini-3-flash";

const FALLBACK_MODELS = [
  "meta/llama-4-scout",
  "google/gemini-2.5-flash-lite",
  "xai/grok-4-fast-reasoning",
  "google/gemini-2.5-flash",
  "openai/gpt-4.1-mini",
];

const ALLOWED_CATEGORIES = [
  "arts",
  "business",
  "communication",
  "culture",
  "economics",
  "engineering",
  "geography",
  "health",
  "history",
  "languages",
  "law",
  "math",
  "science",
  "society",
  "tech",
] as const;

const schema = z.object({
  categories: z.array(z.enum(ALLOWED_CATEGORIES)),
});

export type CourseCategoriesSchema = z.infer<typeof schema>;

export type CourseCategoriesParams = {
  courseTitle: string;
  model?: string;
  useFallback?: boolean;
};

export async function generateCourseCategories({
  courseTitle,
  model = DEFAULT_MODEL,
  useFallback = true,
}: CourseCategoriesParams) {
  const userPrompt = `COURSE_TITLE: ${courseTitle}`;

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
