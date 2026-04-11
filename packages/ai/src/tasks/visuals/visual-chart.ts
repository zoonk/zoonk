import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import systemPrompt from "./visual-chart.prompt.md";

const DEFAULT_MODEL = "google/gemini-3.1-flash-lite-preview";
const FALLBACK_MODELS = ["openai/gpt-5.4-mini", "anthropic/claude-haiku-4.5"];

/**
 * Matches `chartVisualContentSchema` from `@zoonk/core/steps/contract/visual`.
 * Defined inline because `@zoonk/core` depends on `@zoonk/ai`,
 * so importing from core would create a circular dependency.
 */
const schema = z
  .object({
    chartType: z.enum(["bar", "line", "pie"]),
    data: z.array(
      z.object({
        name: z.string(),
        value: z.number(),
      }),
    ),
    title: z.string(),
  })
  .strict();

export type VisualChartSchema = z.infer<typeof schema>;

export type VisualChartParams = {
  description: string;
  language: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

/**
 * Generates structured chart data from a textual description.
 * Takes a visual description (from a kind-selection task like
 * `generateVisualDescriptions`) and produces chart content
 * matching `chartVisualContentSchema`: chart type, data points,
 * and a title.
 */
export async function generateVisualChart({
  description,
  language,
  model = DEFAULT_MODEL,
  useFallback = true,
  reasoningEffort,
}: VisualChartParams) {
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
