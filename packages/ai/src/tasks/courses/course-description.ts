import "server-only";

import { generateText, Output } from "ai";
import { z } from "zod";
import { buildProviderOptions, type ReasoningEffort } from "../../types";
import systemPrompt from "./course-description.prompt.md";

const DEFAULT_MODEL =
  process.env.AI_MODEL_COURSE_DESCRIPTION || "xai/grok-4-fast-reasoning";

const FALLBACK_MODELS = [
  "google/gemini-2.5-flash",
  "google/gemini-3-flash",
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
  language: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

export async function generateCourseDescription({
  title,
  language,
  model = DEFAULT_MODEL,
  useFallback = true,
  reasoningEffort,
}: CourseDescriptionParams) {
  const userPrompt = `
    COURSE_TITLE: ${title}
    LANGUAGE: ${language}
  `;

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
