import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import systemPrompt from "./visual-diagram.prompt.md";

const DEFAULT_MODEL = process.env.AI_MODEL_VISUAL_DIAGRAM ?? "openai/gpt-5.4-mini";
const FALLBACK_MODELS = ["google/gemini-3-flash"];

/**
 * Matches `diagramVisualContentSchema` from `@zoonk/core/steps/contract/visual`.
 * Defined inline because `@zoonk/core` depends on `@zoonk/ai`,
 * so importing from core would create a circular dependency.
 */
const schema = z
  .object({
    edges: z.array(
      z.object({
        label: z.string().optional(),
        source: z.string(),
        target: z.string(),
      }),
    ),
    nodes: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
      }),
    ),
  })
  .strict();

export type VisualDiagramSchema = z.infer<typeof schema>;

export type VisualDiagramParams = {
  description: string;
  language: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

/**
 * Generates structured diagram data from a textual description.
 * Takes a visual description (from a kind-selection task like
 * `generateInvestigationVisual`) and produces diagram content
 * matching `diagramVisualContentSchema`: nodes with labels
 * and edges showing connections between them.
 */
export async function generateVisualDiagram({
  description,
  language,
  model = DEFAULT_MODEL,
  useFallback = true,
  reasoningEffort,
}: VisualDiagramParams) {
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
