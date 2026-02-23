import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ReasoningEffort, buildProviderOptions } from "../../provider-options";
import systemPrompt from "./course-suggestions.prompt.md";

const DEFAULT_MODEL = process.env.AI_MODEL_COURSE_SUGGESTIONS || "google/gemini-3-flash";

const FALLBACK_MODELS = [
  "openai/gpt-5-mini",
  "openai/gpt-5.1-instant",
  "google/gemini-3.1-pro-preview",
  "openai/gpt-5.2",
];

const schema = z.object({
  courses: z.array(
    z.object({
      description: z.string(),
      targetLanguageCode: z.string().nullable(),
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
