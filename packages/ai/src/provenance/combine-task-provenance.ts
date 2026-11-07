import { type LanguageModelUsage } from "ai";
import { type TaskProvenance } from "./task-provenance";

type TaskUsage = TaskProvenance["usage"];

/** Providers may leave a token count out: the total is unknown only when no part reported one. */
export function sumKnown(values: readonly (number | undefined)[]): number | undefined {
  const known = values.filter((value) => value !== undefined);

  if (known.length === 0) {
    return undefined;
  }

  return known.reduce((total, value) => total + value, 0);
}

export function sumLanguageModelUsage(usages: readonly LanguageModelUsage[]): LanguageModelUsage {
  const sum = (read: (usage: LanguageModelUsage) => number | undefined) =>
    sumKnown(usages.map((usage) => read(usage)));

  return {
    inputTokenDetails: {
      cacheReadTokens: sum((usage) => usage.inputTokenDetails.cacheReadTokens),
      cacheWriteTokens: sum((usage) => usage.inputTokenDetails.cacheWriteTokens),
      noCacheTokens: sum((usage) => usage.inputTokenDetails.noCacheTokens),
    },
    inputTokens: sum((usage) => usage.inputTokens),
    outputTokenDetails: {
      reasoningTokens: sum((usage) => usage.outputTokenDetails.reasoningTokens),
      textTokens: sum((usage) => usage.outputTokenDetails.textTokens),
    },
    outputTokens: sum((usage) => usage.outputTokens),
    totalTokens: sum((usage) => usage.totalTokens),
  };
}

export function joinDistinct(values: readonly string[]): string {
  return [...new Set(values)].join(", ");
}

/**
 * Latency is the slowest call's and the row keeps the first call's run id; each call still sends
 * its own `$ai_generation` event.
 */
export function combineTaskProvenance(runs: readonly TaskProvenance[]): TaskProvenance {
  const [first] = runs;

  if (!first) {
    throw new Error("Combining provenance needs at least one run.");
  }

  const sum = (read: (usage: TaskUsage) => number | undefined) =>
    sumKnown(runs.map((run) => read(run.usage)));

  return {
    costUsd: sumKnown(runs.map((run) => run.costUsd)),
    credential: first.credential,
    gatewayCostUsd: sumKnown(runs.map((run) => run.gatewayCostUsd)),
    generatedAt:
      runs
        .map((run) => run.generatedAt)
        .toSorted()
        .at(-1) ?? first.generatedAt,
    latencyMs: Math.max(...runs.map((run) => run.latencyMs)),
    model: joinDistinct(runs.map((run) => run.model)),
    promptVersion: first.promptVersion,
    provider: joinDistinct(runs.map((run) => run.provider)),
    requestedModel: first.requestedModel,
    runId: first.runId,
    serviceTier: first.serviceTier,
    usage: {
      audioSeconds: sum((usage) => usage.audioSeconds),
      cacheReadTokens: sum((usage) => usage.cacheReadTokens),
      cacheWriteTokens: sum((usage) => usage.cacheWriteTokens),
      inputTokens: sum((usage) => usage.inputTokens),
      outputTokens: sum((usage) => usage.outputTokens),
      reasoningTokens: sum((usage) => usage.reasoningTokens),
      totalTokens: sum((usage) => usage.totalTokens),
    },
  };
}
