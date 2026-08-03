import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type Reasoning, buildProviderOptions } from "../../provider-options";
import systemPrompt from "./course-format.prompt.md";

const defaultModel = "google/gemini-3.1-flash-lite";

const fallbackModels = [
  "openai/gpt-5.6-luna",
  "deepseek/deepseek-v4-flash",
  "openai/gpt-5.4-mini",
  "anthropic/claude-haiku-4.5",
] as const;

const courseFormatSchema = z.enum(["core", "language", "coding", "instrument", "practical"]);

const schema = z.object({ courseFormat: courseFormatSchema });

export type CourseFormat = z.infer<typeof courseFormatSchema>;
export type CourseFormatSchema = z.infer<typeof schema>;

export type CourseFormatParams = {
  prompt: string;
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
};

/**
 * Decides the teaching format for shared learning prompts. The caller ignores
 * this output unless intent and personalization say a reusable course fits, so
 * this task only needs to separate supported course formats.
 */
export async function classifyCourseFormat({
  model = defaultModel,
  prompt,
  reasoning,
  useFallback = true,
}: CourseFormatParams) {
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
