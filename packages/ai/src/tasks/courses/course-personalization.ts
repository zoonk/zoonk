import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type Reasoning, buildProviderOptions } from "../../provider-options";
import { getPromptLanguageName } from "../_utils/prompt-language";
import systemPrompt from "./course-personalization.prompt.md";

const defaultModel = "openai/gpt-5.6-luna";

const fallbackModels = [
  "google/gemini-3.1-flash-lite",
  "anthropic/claude-haiku-4.5",
  "openai/gpt-5.4-mini",
  "deepseek/deepseek-v4-flash",
] as const;

const schema = z.object({ requiresPersonalization: z.boolean() });

export type CoursePersonalizationSchema = z.infer<typeof schema>;

export type CoursePersonalizationParams = {
  language: string;
  prompt: string;
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
};

/**
 * Decides whether a learning request needs learner-specific context before it
 * can become useful. Intent routing decides whether this answer matters; this
 * task only answers the reusable-versus-personalized course boundary.
 */
export async function classifyCoursePersonalization({
  language,
  model = defaultModel,
  prompt,
  reasoning,
  useFallback = true,
}: CoursePersonalizationParams) {
  const promptLanguage = getPromptLanguageName({ language });

  const userPrompt = `
    LANGUAGE: ${promptLanguage}
    USER_INPUT: ${prompt}
  `;

  const providerOptions = buildProviderOptions({ fallbackModels, model, useFallback });

  const { output, usage } = await generateText({
    instructions: systemPrompt,
    model,
    output: Output.object({ schema }),
    prompt: userPrompt,
    providerOptions,
    reasoning,
  });

  return { data: output, systemPrompt, usage, userPrompt };
}
