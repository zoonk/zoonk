import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import systemPrompt from "./visual-image.prompt.md";

const DEFAULT_MODEL = process.env.AI_MODEL_VISUAL_IMAGE ?? "openai/gpt-5.4-mini";
const FALLBACK_MODELS = ["google/gemini-3-flash"];

/**
 * Matches the required fields of `imageVisualContentSchema`
 * from `@zoonk/core/steps/contract/visual` (without the optional `url`
 * field, which is set later by the image generation pipeline).
 * Defined inline because `@zoonk/core` depends on `@zoonk/ai`,
 * so importing from core would create a circular dependency.
 */
const schema = z
  .object({
    prompt: z.string(),
  })
  .strict();

export type VisualImageSchema = z.infer<typeof schema>;

export type VisualImageParams = {
  description: string;
  language: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

/**
 * Generates a refined image generation prompt from a textual description.
 * Takes a visual description (from a kind-selection task like
 * `generateInvestigationVisual`) and produces an optimized prompt
 * for an image generation model. The prompt focuses on content
 * (not style) and follows image generation best practices.
 */
export async function generateVisualImage({
  description,
  language,
  model = DEFAULT_MODEL,
  useFallback = true,
  reasoningEffort,
}: VisualImageParams) {
  const userPrompt = `
    VISUAL_DESCRIPTION: ${description}
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
