import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type Reasoning, buildProviderOptions } from "../../provider-options";
import systemPrompt from "./course-intent.prompt.md";

const defaultModel = "openai/gpt-5.6-luna";
const fallbackModels = ["google/gemini-3.1-flash-lite", "openai/gpt-5.4-mini"] as const;

const courseIntentSchema = z.enum(["unsafe", "exam", "question", "learn", "ambiguous"]);

const schema = z.object({ intent: courseIntentSchema });

export type CourseIntent = z.infer<typeof courseIntentSchema>;
export type CourseIntentSchema = z.infer<typeof schema>;

export type CourseIntentParams = {
  prompt: string;
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
};

/**
 * Classifies the learner's product intent before any generation workflow runs.
 * This first decision only chooses the surface that should handle the prompt;
 * personalization and course format are decided by separate parallel tasks.
 */
export async function classifyCourseIntent({
  model = defaultModel,
  prompt,
  reasoning,
  useFallback = true,
}: CourseIntentParams) {
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
  });

  return { data: output, systemPrompt, usage, userPrompt };
}
