import { type VisualDescription } from "@zoonk/ai/tasks/steps/visual-descriptions";
import { generateVisualChart } from "@zoonk/ai/tasks/visuals/chart";
import { generateVisualCode } from "@zoonk/ai/tasks/visuals/code";
import { generateVisualDiagram } from "@zoonk/ai/tasks/visuals/diagram";
import { generateVisualFormula } from "@zoonk/ai/tasks/visuals/formula";
import { generateVisualMusic } from "@zoonk/ai/tasks/visuals/music";
import { generateVisualQuote } from "@zoonk/ai/tasks/visuals/quote";
import { generateVisualTable } from "@zoonk/ai/tasks/visuals/table";
import { generateVisualTimeline } from "@zoonk/ai/tasks/visuals/timeline";
import { generateVisualStepImage } from "@zoonk/core/steps/visual-image";
import { toError } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";

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

type DispatchFailure = {
  description: VisualDescription;
  error: Error;
};

/**
 * Image visuals must return a real uploaded URL.
 * Throwing here is intentional: storing `{ kind: "image", url: null }` looks like
 * success to the workflow layer, which prevents the step runtime from retrying
 * transient gateway and network failures.
 */
function getImageUrlOrThrow({ error, url }: { error: Error | null; url: string | null }): string {
  if (error) {
    throw error;
  }

  if (!url) {
    throw new Error("Image generation returned no URL");
  }

  return url;
}

/**
 * Finds the first rejected image dispatch so the caller can abort the whole
 * step and let Workflow's built-in retries handle transient image failures.
 * Structured visuals still fall back to prompt-only images because they do not
 * depend on an external uploaded asset being present.
 */
function getImageDispatchFailure({
  descriptions,
  results,
}: {
  descriptions: VisualDescription[];
  results: PromiseSettledResult<DispatchedVisual | null>[];
}): DispatchFailure | null {
  for (const [index, description] of descriptions.entries()) {
    const result = results[index];

    if (description.kind === "image" && result?.status === "rejected") {
      return { description, error: toError(result.reason) };
    }
  }

  return null;
}

/**
 * Re-throws image dispatch failures so the surrounding `"use step"` function
 * fails loudly. Workflow retries only happen when the step throws, so this
 * guard preserves retries for transient image-generation outages.
 */
function throwIfImageDispatchFailed({
  descriptions,
  results,
}: {
  descriptions: VisualDescription[];
  results: PromiseSettledResult<DispatchedVisual | null>[];
}): void {
  const failure = getImageDispatchFailure({ descriptions, results });

  if (!failure) {
    return;
  }

  logError("Image visual dispatch failed, rethrowing to allow workflow retry", {
    description: failure.description.description,
    kind: failure.description.kind,
  });

  throw failure.error;
}

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
    const { data: url, error } = await generateVisualStepImage({
      language,
      orgSlug,
      prompt: description.description,
    });

    return {
      kind: "image",
      prompt: description.description,
      url: getImageUrlOrThrow({ error, url }),
    };
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

  throwIfImageDispatchFailed({ descriptions, results });

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
