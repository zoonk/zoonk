import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import { normalizeVisualMusicOutput } from "./_utils/music-notation";
import systemPrompt from "./visual-music.prompt.md";

const DEFAULT_MODEL = process.env.AI_MODEL_VISUAL_MUSIC ?? "google/gemini-3.1-pro-preview";
const FALLBACK_MODELS = ["openai/gpt-5.4", "anthropic/claude-opus-4.6"];

/**
 * Matches `musicVisualContentSchema` from `@zoonk/core/steps/contract/visual`.
 * Defined inline because `@zoonk/core` depends on `@zoonk/ai`,
 * so importing from core would create a circular dependency.
 */
const schema = z
  .object({
    abc: z.string(),
    description: z.string(),
  })
  .strict();

export type VisualMusicSchema = z.infer<typeof schema>;

export type VisualMusicParams = {
  description: string;
  language: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

/**
 * Generates structured music notation data from a textual description.
 * Takes a visual description (from a kind-selection task like
 * `generateVisualDescriptions`) and produces music content
 * matching `musicVisualContentSchema`: ABC notation and a
 * plain-text explanation of what the notation demonstrates.
 */
export async function generateVisualMusic({
  description,
  language,
  model = DEFAULT_MODEL,
  useFallback = true,
  reasoningEffort,
}: VisualMusicParams) {
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

  const data = normalizeVisualMusicOutput(output);

  return { data, systemPrompt, usage, userPrompt };
}
