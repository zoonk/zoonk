import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import systemPrompt from "./visual-formula.prompt.md";

const DEFAULT_MODEL = "openai/gpt-5.4-mini";
const FALLBACK_MODELS = ["anthropic/claude-haiku-4.5", "google/gemini-3.1-flash-lite-preview"];

/**
 * Matches `formulaVisualContentSchema` from `@zoonk/core/steps/contract/visual`.
 * Defined inline because `@zoonk/core` depends on `@zoonk/ai`,
 * so importing from core would create a circular dependency.
 */
const schema = z
  .object({
    description: z.string(),
    formula: z.string(),
  })
  .strict();

export type VisualFormulaSchema = z.infer<typeof schema>;

export type VisualFormulaParams = {
  description: string;
  language: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

/**
 * Generates structured formula data from a textual description.
 * Takes a visual description (from a kind-selection task like
 * `generateVisualDescriptions`) and produces formula content
 * matching `formulaVisualContentSchema`: a LaTeX math expression
 * and a plain-text explanation of what the formula represents.
 */
export async function generateVisualFormula({
  description,
  language,
  model = DEFAULT_MODEL,
  useFallback = true,
  reasoningEffort,
}: VisualFormulaParams) {
  const userPrompt = `
    VISUAL_DESCRIPTION: ${description}
    LANGUAGE: ${language}
  `;

  const providerOptions = buildProviderOptions({
    fallbackModels: FALLBACK_MODELS,
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
