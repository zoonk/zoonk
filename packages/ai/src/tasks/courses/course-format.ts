import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ReasoningEffort, buildProviderOptions } from "../../provider-options";
import { getPromptLanguageName } from "../_utils/prompt-language";
import systemPrompt from "./course-format.prompt.md";

const defaultModel = "openai/gpt-5.6-luna";

const fallbackModels = [
  "google/gemini-3.1-flash-lite",
  "deepseek/deepseek-v4-flash",
  "openai/gpt-5.4-mini",
  "anthropic/claude-haiku-4.5",
] as const;

const courseFormatSchema = z.enum([
  "core",
  "language",
  "coding",
  "instrument",
  "product",
  "practical",
]);

const schema = z.object({ courseFormat: courseFormatSchema });

export type CourseFormat = z.infer<typeof courseFormatSchema>;
export type CourseFormatSchema = z.infer<typeof schema>;

export type CourseFormatParams = {
  language: string;
  prompt: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

/**
 * Decides the teaching format for shared learning prompts. The caller ignores
 * this output unless intent and personalization say a reusable course fits, so
 * this task only needs to separate supported course formats.
 */
export async function classifyCourseFormat({
  language,
  model = defaultModel,
  prompt,
  reasoningEffort,
  useFallback = true,
}: CourseFormatParams) {
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
