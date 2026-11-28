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

type StoredProvenance = Pick<TaskProvenance, "generatedAt" | "model" | "promptVersion" | "runId">;

function firstRun<T extends StoredProvenance>(runs: readonly T[]): T {
  const [first] = runs;

  if (!first) {
    throw new Error("Combining provenance needs at least one run.");
  }

  return first;
}

export function combineStoredProvenance(runs: readonly StoredProvenance[]): StoredProvenance {
  const first = firstRun(runs);

  return {
    generatedAt:
      runs
        .map((run) => run.generatedAt)
        .toSorted()
        .at(-1) ?? first.generatedAt,
    model: joinDistinct(runs.map((run) => run.model)),
    promptVersion: first.promptVersion,
    runId: first.runId,
  };
}

/**
 * Latency is the slowest call's and the row keeps the first call's run id; each call still logs
 * its own AI call.
 */
export function combineTaskProvenance(runs: readonly TaskProvenance[]): TaskProvenance {
  const first = firstRun(runs);

  const sum = (read: (usage: TaskUsage) => number | undefined) =>
    sumKnown(runs.map((run) => read(run.usage)));

  return {
    ...combineStoredProvenance(runs),
    costUsd: sumKnown(runs.map((run) => run.costUsd)),
    credential: first.credential,
    gatewayCostUsd: sumKnown(runs.map((run) => run.gatewayCostUsd)),
    latencyMs: Math.max(...runs.map((run) => run.latencyMs)),
    provider: joinDistinct(runs.map((run) => run.provider)),
    requestedModel: first.requestedModel,
    serviceTier: first.serviceTier,
    ...(runs.every((run) => run.speed === "fast") ? { speed: "fast" as const } : {}),
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
