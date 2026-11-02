import { type LanguageModelUsage, type ProviderMetadata } from "ai";
import { type CallUsage, computeCallCostUsd } from "../pricing/call-cost";
import { readGatewayMetadata } from "./gateway-metadata";

type TaskUsage = CallUsage & { totalTokens?: number; reasoningTokens?: number };

/** Generated rows store `model`, `promptVersion`, `runId` and `generatedAt`; analytics the rest. */
export type TaskProvenance = {
  /** Joined when steps used different models, fallbacks included. */
  model: string;
  requestedModel: string;
  /** Joined when steps used different providers. */
  provider: string;
  promptVersion: string;
  runId: string;
  usage: TaskUsage;
  /** Unknown for a model our price list doesn't price. */
  costUsd?: number;
  /** A cross-check for `costUsd`; unknown off the gateway. */
  gatewayCostUsd?: number;
  /** `mixed` for steps served at different tiers; unset at the standard tier. */
  serviceTier?: string;
  /** `byok` when our provider key paid for the call, `system` when the gateway's credits did. */
  credential?: string;
  latencyMs: number;
  generatedAt: string;
};

type GenerationStep = {
  model: { modelId: string; provider: string };
  providerMetadata: ProviderMetadata | undefined;
  response: { modelId: string };
  usage: LanguageModelUsage;
};

export type FinishedGeneration = {
  finalStep: GenerationStep;
  steps: readonly GenerationStep[];
  usage: LanguageModelUsage;
};

/** AI SDK usage counts cached input tokens inside `inputTokens` for every provider. */
function toTaskUsage(usage: LanguageModelUsage): TaskUsage {
  return {
    cacheReadTokens: usage.inputTokenDetails.cacheReadTokens,
    cacheWriteTokens: usage.inputTokenDetails.cacheWriteTokens,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    reasoningTokens: usage.outputTokenDetails.reasoningTokens,
    totalTokens: usage.totalTokens,
  };
}

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

function joinDistinct(values: readonly string[]): string {
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

/** Steps can differ in fallback model, tier and context length. */
function priceStep(step: GenerationStep) {
  const gateway = readGatewayMetadata(step.providerMetadata);
  const model = gateway.servedModel ?? step.response.modelId;

  return {
    costUsd: computeCallCostUsd({
      model,
      serviceTier: gateway.serviceTier,
      usage: toTaskUsage(step.usage),
    }),
    gatewayCostUsd: gateway.costUsd,
    model,
    provider: gateway.servedProvider ?? step.model.provider,
    serviceTier: gateway.serviceTier,
  };
}

/** The ledger's tier label fits its ten-character field; prices still use each step's actual tier. */
function getServedServiceTier(tiers: readonly (string | undefined)[]): string | undefined {
  const distinct = new Set(tiers.map((tier) => tier ?? "standard"));

  if (distinct.size > 1) {
    return "mixed";
  }

  const [tier] = distinct;
  return tier === "standard" ? undefined : tier;
}

/**
 * The gateway's `doGenerate` replaces the response metadata, so `response.modelId` is the requested
 * model even when a fallback answered; the gateway's routing metadata names the model that did.
 */
export function buildTaskProvenance({
  generatedAt,
  generation,
  latencyMs,
  promptVersion,
  runId,
}: {
  generatedAt: string;
  generation: FinishedGeneration;
  latencyMs: number;
  promptVersion: string;
  runId: string;
}): TaskProvenance {
  const { finalStep } = generation;
  const gateway = readGatewayMetadata(finalStep.providerMetadata);
  const steps = generation.steps.map(priceStep);
  const costs = steps.map((step) => step.costUsd);
  const usage = toTaskUsage(generation.usage);

  return {
    /** A partial sum would hide unpriced steps from the ledger's unknown-cost count. */
    costUsd: costs.some((cost) => cost === undefined) ? undefined : sumKnown(costs),
    credential: gateway.credential,
    gatewayCostUsd: sumKnown(steps.map((step) => step.gatewayCostUsd)),
    generatedAt,
    latencyMs,
    model: joinDistinct(steps.map((step) => step.model)),
    promptVersion,
    provider: joinDistinct(steps.map((step) => step.provider)),
    requestedModel: finalStep.model.modelId,
    runId,
    serviceTier: getServedServiceTier(steps.map((step) => step.serviceTier)),
    usage,
  };
}
