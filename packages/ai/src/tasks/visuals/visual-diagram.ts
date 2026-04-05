import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { toSlug } from "@zoonk/utils/string";
import { Output, generateText } from "ai";
import { z } from "zod";
import systemPrompt from "./visual-diagram.prompt.md";

const DEFAULT_MODEL = process.env.AI_MODEL_VISUAL_DIAGRAM ?? "google/gemini-3.1-flash-lite-preview";
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
 * Finds the best matching node ID for an edge's `from` or `to` label.
 * Tries exact label match first, then case-insensitive, then substring.
 * Returns the slugified input as fallback so edges always have valid IDs.
 */
function resolveNodeId(edgeLabel: string, nodeMap: Map<string, string>): string {
  const direct = nodeMap.get(edgeLabel);

  if (direct) {
    return direct;
  }

  const lower = edgeLabel.toLowerCase();
  const entries = [...nodeMap];

  const caseInsensitive = entries.find(([label]) => label.toLowerCase() === lower);

  if (caseInsensitive) {
    return caseInsensitive[1];
  }

  const substring = entries.find(([label]) => {
    const labelLower = label.toLowerCase();
    return labelLower.includes(lower) || lower.includes(labelLower);
  });

  return substring?.[1] ?? toSlug(edgeLabel);
}

type AiDiagramOutput = z.infer<typeof aiSchema>;

/**
 * Converts AI-generated label-only nodes and from/to edges into
 * the public diagram schema with auto-generated IDs and
 * source/target references. Removes orphan nodes that aren't
 * referenced by any edge.
 */
function buildDiagram(output: AiDiagramOutput): VisualDiagramSchema {
  const allNodes = output.nodes.map((node) => ({
    id: toSlug(node.label),
    label: node.label,
  }));

  const nodeMap = new Map(allNodes.map((node) => [node.label, node.id]));

  const edges = output.edges.map((edge) => ({
    label: edge.label,
    source: resolveNodeId(edge.from, nodeMap),
    target: resolveNodeId(edge.to, nodeMap),
  }));

  const referencedIds = new Set(edges.flatMap((edge) => [edge.source, edge.target]));
  const nodes = allNodes.filter((node) => referencedIds.has(node.id));

  return { edges, nodes };
}

/**
 * Generates structured diagram data from a textual description.
 * Takes a visual description (from a kind-selection task like
 * `generateInvestigationVisual`) and produces diagram content
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

  const data = buildDiagram(output);

  return { data, systemPrompt, usage, userPrompt };
}
