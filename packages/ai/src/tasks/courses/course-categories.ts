import "server-only";
import { COURSE_CATEGORIES } from "@zoonk/utils/categories";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ReasoningEffort, buildProviderOptions } from "../../types";
import systemPrompt from "./course-categories.prompt.md";

const DEFAULT_MODEL = process.env.AI_MODEL_COURSE_CATEGORIES ?? "google/gemini-3-flash";

const FALLBACK_MODELS = [
  "meta/llama-4-scout",
  "google/gemini-2.5-flash-lite",
  "xai/grok-4-fast-reasoning",
  "google/gemini-2.5-flash",
  "openai/gpt-4.1-mini",
];

const schema = z.object({
  categories: z.array(z.enum(COURSE_CATEGORIES)),
});

export type CourseCategoriesSchema = z.infer<typeof schema>;

export type CourseCategoriesParams = {
  courseTitle: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

export async function generateCourseCategories({
  courseTitle,
  model = DEFAULT_MODEL,
  useFallback = true,
  reasoningEffort,
}: CourseCategoriesParams) {
  const userPrompt = `COURSE_TITLE: ${courseTitle}`;

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
