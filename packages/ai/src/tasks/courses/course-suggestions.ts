import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ReasoningEffort, buildProviderOptions } from "../../types";
import systemPrompt from "./course-suggestions.prompt.md";

const DEFAULT_MODEL = process.env.AI_MODEL_COURSE_SUGGESTIONS ?? "google/gemini-3-flash";

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
  language: string;
  prompt: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

export async function generateCourseSuggestions({
  language,
  prompt,
  model = DEFAULT_MODEL,
  useFallback = true,
  reasoningEffort,
}: CourseSuggestionsParams) {
  const userPrompt = `
    LANGUAGE: ${language}
    USER_INPUT: ${prompt}
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

  return { data: output.courses, systemPrompt, usage, userPrompt };
}
