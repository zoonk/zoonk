import "server-only";
import { type VisualDescription } from "@zoonk/ai/tasks/steps/visual-descriptions";
import { generateVisualChart } from "@zoonk/ai/tasks/visuals/chart";
import { generateVisualCode } from "@zoonk/ai/tasks/visuals/code";
import { generateVisualDiagram } from "@zoonk/ai/tasks/visuals/diagram";
import { generateVisualFormula } from "@zoonk/ai/tasks/visuals/formula";
import { generateVisualMusic } from "@zoonk/ai/tasks/visuals/music";
import { generateVisualQuote } from "@zoonk/ai/tasks/visuals/quote";
import { generateVisualTable } from "@zoonk/ai/tasks/visuals/table";
import { generateVisualTimeline } from "@zoonk/ai/tasks/visuals/timeline";
import { logError } from "@zoonk/utils/logger";
import { generateVisualStepImage } from "./step-visual-image";

/**
 * Result of dispatching a single visual description to its per-kind
 * generation task. Contains the visual kind and its structured content
 * ready for database storage.
 */
type DispatchedVisual = {
  kind: string;
} & Record<string, unknown>;

/**
 * Maps each structured visual kind to its generation function. All
 * functions in this map share the same interface: they take
 * `{ description, language }` and return `{ data }`. The `image`
 * kind is handled separately because it generates and uploads an
 * actual image file instead of structured data.
 */
const structuredGenerators: Record<
  string,
  (params: { description: string; language: string }) => Promise<{ data: Record<string, unknown> }>
> = {
  chart: generateVisualChart,
  code: generateVisualCode,
  diagram: generateVisualDiagram,
  formula: generateVisualFormula,
  music: generateVisualMusic,
  quote: generateVisualQuote,
  table: generateVisualTable,
  timeline: generateVisualTimeline,
};

/**
 * Generates structured visual content for a single description by
 * calling the appropriate per-kind task. For image kinds, generates
 * and uploads the actual image. Returns null if generation fails.
 */
async function dispatchSingle({
  description,
  language,
  orgSlug,
}: {
  description: VisualDescription;
  language: string;
  orgSlug?: string;
}): Promise<DispatchedVisual | null> {
  if (description.kind === "image") {
    const { data: url } = await generateVisualStepImage({
      language,
      orgSlug,
      prompt: description.description,
    });
    return { kind: "image", prompt: description.description, url };
  }

  const generator = structuredGenerators[description.kind];

  if (!generator) {
    return { kind: "image", prompt: description.description };
  }

  const { data } = await generator({ description: description.description, language });
  return { kind: description.kind, ...data };
}

/**
 * Dispatches each visual description to the appropriate per-kind
 * generation task (chart, code, diagram, etc.) and runs all of them
 * in parallel. For image kinds, this also generates and uploads the
 * actual image — so there is no separate image generation step.
 *
 * Returns an ordered array matching the input descriptions. If a
 * single dispatch fails, it falls back to an image visual using the
 * description as the prompt, so downstream steps always get one
 * visual per step.
 */
export async function dispatchVisualContent({
  descriptions,
  language,
  orgSlug,
}: {
  descriptions: VisualDescription[];
  language: string;
  orgSlug?: string;
}): Promise<DispatchedVisual[]> {
  const results = await Promise.allSettled(
    descriptions.map((description) => dispatchSingle({ description, language, orgSlug })),
  );

  return results.map((result, index) => {
    if (result.status === "fulfilled" && result.value) {
      return result.value;
    }

    const description = descriptions[index];

    logError("Visual dispatch failed, falling back to image", {
      description: description?.description,
      kind: description?.kind,
    });

    return {
      kind: "image",
      prompt: description?.description ?? "",
    };
  });
}
