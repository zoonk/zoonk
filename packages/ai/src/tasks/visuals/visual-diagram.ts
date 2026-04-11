import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import { buildVisualDiagramOutput } from "./_utils/diagram-output";
import systemPrompt from "./visual-diagram.prompt.md";

const DEFAULT_MODEL = "google/gemini-3.1-flash-lite-preview";
const FALLBACK_MODELS = ["anthropic/claude-sonnet-4.6", "openai/gpt-5.4-nano"];

/**
 * Internal schema for AI generation. Uses `label`-only nodes
 * (IDs are auto-generated) and `from`/`to` labels on edges
 * (resolved to `source`/`target` IDs) because models are good
 * at naming things but bad at maintaining consistent ID references.
 */
const aiSchema = z
  .object({
    edges: z.array(
      z.object({
        from: z.string(),
        label: z.string().nullable(),
        to: z.string(),
      }),
    ),
    nodes: z.array(
      z.object({
        label: z.string(),
      }),
    ),
  })
  .strict();

/**
 * Public output type matching `diagramVisualContentSchema`
 * from `@zoonk/core/steps/contract/visual`. Defined as a plain
 * type (not a Zod schema) because it's never parsed — the AI
 * uses `aiSchema` and `buildDiagram` produces this shape.
 */
export type VisualDiagramSchema = {
  edges: { label: string | null; source: string; target: string }[];
  nodes: { id: string; label: string }[];
};

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
 * `generateVisualDescriptions`) and produces diagram content
 * matching `diagramVisualContentSchema`: nodes with labels
 * and edges showing connections between them.
 *
 * Internally, the AI generates label-only nodes and uses
 * `from`/`to` labels on edges. The `buildDiagram` function
 * auto-generates node IDs, resolves edge references, and
 * removes orphan nodes.
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
    model,
    reasoningEffort,
    useFallback,
  });

  const { output, usage } = await generateText({
    model,
    output: Output.object({ schema: aiSchema }),
    prompt: userPrompt,
    providerOptions,
    system: systemPrompt,
  });

  const data: VisualDiagramSchema = buildVisualDiagramOutput(output);

  return { data, systemPrompt, usage, userPrompt };
}
