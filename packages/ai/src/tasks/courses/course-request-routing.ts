import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ReasoningEffort, buildProviderOptions } from "../../provider-options";
import { getPromptLanguageName } from "../_utils/prompt-language";
import systemPrompt from "./course-request-routing.prompt.md";

const defaultModel = "google/gemini-3.1-flash-lite";
const fallbackModels = ["openai/gpt-5.4-mini", "deepseek/deepseek-v4-flash"] as const;

const courseRequestScopeSchema = z.enum(["unsafe", "language", "exam", "topic"]);

const schema = z.object({ scope: courseRequestScopeSchema });

export type CourseRequestScope = z.infer<typeof courseRequestScopeSchema>;
export type CourseRequestRoutingSchema = z.infer<typeof schema>;

export type CourseRequestRoutingParams = {
  language: string;
  prompt: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

/**
 * Classifies a learner's open-ended start prompt before any generation workflow
 * runs. This first routing pass only separates requests that leave the normal
 * learn flow: unsafe, language, and exam. All other learn requests continue as
 * topic so a second task can decide the product shape without competing with
 * language, exam, or safety rules.
 */
export async function routeCourseRequest({
  language,
  model = defaultModel,
  prompt,
  reasoningEffort,
  useFallback = true,
}: CourseRequestRoutingParams) {
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
