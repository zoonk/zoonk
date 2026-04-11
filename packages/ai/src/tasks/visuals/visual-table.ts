import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import systemPrompt from "./visual-table.prompt.md";

const DEFAULT_MODEL = "google/gemini-3.1-flash-lite-preview";
const FALLBACK_MODELS = ["openai/gpt-5.4-mini", "anthropic/claude-haiku-4.5"];

/**
 * Matches `tableVisualContentSchema` from `@zoonk/core/steps/contract/visual`.
 * Defined inline because `@zoonk/core` depends on `@zoonk/ai`,
 * so importing from core would create a circular dependency.
 * Uses `.nullable()` instead of `.optional()` because OpenAI
 * structured outputs require all fields to be present in the JSON.
 */
const schema = z
  .object({
    caption: z.string().nullable(),
    columns: z.array(z.string()),
    rows: z.array(z.array(z.string())),
  })
  .strict();

export type VisualTableSchema = z.infer<typeof schema>;

export type VisualTableParams = {
  description: string;
  language: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

/**
 * Generates structured table data from a textual description.
 * Takes a visual description (from a kind-selection task like
 * `generateVisualDescriptions`) and produces table content
 * matching `tableVisualContentSchema`: column headers, data rows,
 * and an optional caption.
 */
export async function generateVisualTable({
  description,
  language,
  model = DEFAULT_MODEL,
  useFallback = true,
  reasoningEffort,
}: VisualTableParams) {
  const userPrompt = `
    VISUAL_DESCRIPTION: ${description}
    LANGUAGE: ${language}
  `;

  const providerOptions = buildProviderOptions({
    fallbackModels: FALLBACK_MODELS,
    model,
    reasoningEffort,
    taskName: "visual-table",
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
