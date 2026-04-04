import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import systemPrompt from "./visual-chart.prompt.md";

const DEFAULT_MODEL = process.env.AI_MODEL_VISUAL_CHART ?? "openai/gpt-5.4-mini";
const FALLBACK_MODELS = ["google/gemini-3-flash"];

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
 * `generateInvestigationVisual`) and produces chart content
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
