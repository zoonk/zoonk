import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type Reasoning, buildProviderOptions } from "../../provider-options";
import systemPrompt from "./course-personalization.prompt.md";

const defaultModel = "google/gemini-3.1-flash-lite";
const fallbackModels = ["openai/gpt-5.6-luna", "anthropic/claude-haiku-4.5"] as const;

const schema = z.object({ requiresPersonalization: z.boolean() });

export type CoursePersonalizationSchema = z.infer<typeof schema>;

export type CoursePersonalizationParams = {
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
  model = defaultModel,
  prompt,
  reasoning,
  useFallback = true,
}: CoursePersonalizationParams) {
  const userPrompt = `
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
    temperature: 0,
  });

  return { data: output, systemPrompt, usage, userPrompt };
}
