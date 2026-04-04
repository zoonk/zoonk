import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import systemPrompt from "./visual-code.prompt.md";

const DEFAULT_MODEL = process.env.AI_MODEL_VISUAL_CODE ?? "openai/gpt-5.4-mini";
const FALLBACK_MODELS = ["google/gemini-3-flash"];

/**
 * Matches `codeVisualContentSchema` from `@zoonk/core/steps/contract/visual`.
 * Defined inline because `@zoonk/core` depends on `@zoonk/ai`,
 * so importing from core would create a circular dependency.
 * Uses `.nullable()` instead of `.optional()` because OpenAI
 * structured outputs require all fields to be present in the JSON.
 */
const schema = z
  .object({
    annotations: z
      .array(
        z.object({
          line: z.number(),
          text: z.string(),
        }),
      )
      .nullable(),
    code: z.string(),
    language: z.string(),
  })
  .strict();

export type VisualCodeSchema = z.infer<typeof schema>;

export type VisualCodeParams = {
  description: string;
  language: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

/**
 * Generates structured code snippet data from a textual description.
 * Takes a visual description (from a kind-selection task like
 * `generateInvestigationVisual`) and produces code content
 * matching `codeVisualContentSchema`: the code snippet,
 * programming language, and optional line annotations.
 */
export async function generateVisualCode({
  description,
  language,
  model = DEFAULT_MODEL,
  useFallback = true,
  reasoningEffort,
}: VisualCodeParams) {
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
