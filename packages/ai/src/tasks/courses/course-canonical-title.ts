import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ReasoningEffort, buildProviderOptions } from "../../provider-options";
import { getPromptLanguageName } from "../_utils/prompt-language";
import systemPrompt from "./course-canonical-title.prompt.md";

const defaultModel = "openai/gpt-5.4-mini";
const fallbackModels = ["google/gemini-3.1-flash-lite", "deepseek/deepseek-v4-flash"] as const;

const schema = z.object({ title: z.string() });

export type CourseCanonicalTitleSchema = z.infer<typeof schema>;

export type CourseCanonicalTitleParams = {
  language: string;
  prompt: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

/**
 * Converts a raw start prompt into the one course title the catalog should use.
 * Keeping this separate from request routing lets the product evolve each mode's
 * generation path without coupling title normalization to scope classification.
 */
export async function generateCanonicalCourseTitle({
  language,
  model = defaultModel,
  prompt,
  reasoningEffort,
  useFallback = true,
}: CourseCanonicalTitleParams) {
  const promptLanguage = getPromptLanguageName({ language });

  const userPrompt = `
    LANGUAGE: ${promptLanguage}
    USER_INPUT: ${prompt}
  `;

  const providerOptions = buildProviderOptions({
    fallbackModels,
    model,
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
