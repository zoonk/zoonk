import { type LanguageModelUsage, type ProviderMetadata } from "ai";
import { type CallUsage, computeCallCostUsd } from "../pricing/call-cost";
import { joinDistinct, sumKnown, sumLanguageModelUsage } from "./combine-task-provenance";
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

export type GenerationStep = {
  model: { modelId: string; provider: string };
  providerMetadata: ProviderMetadata | undefined;
  response: { modelId: string };
  usage: LanguageModelUsage;
};

export type FinishedGeneration = { finalStep: GenerationStep; steps: readonly GenerationStep[] };

export type StreamedGeneration = {
  [Key in keyof FinishedGeneration]: PromiseLike<FinishedGeneration[Key]>;
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

function getServedModel(step: GenerationStep): string {
  return readGatewayMetadata(step.providerMetadata).servedModel ?? step.response.modelId;
}

/** What one call cost, at the model that answered it. */
export function describeStep(step: GenerationStep): { model: string; usage: TaskUsage } {
  return { model: getServedModel(step), usage: toTaskUsage(step.usage) };
}

/** Steps can differ in fallback model, tier and context length. */
function priceStep(step: GenerationStep) {
  const gateway = readGatewayMetadata(step.providerMetadata);
  const model = getServedModel(step);

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
  // A stream whose later step fails resolves the steps it finished, but not their total usage.
  const usage = toTaskUsage(sumLanguageModelUsage(generation.steps.map((step) => step.usage)));

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
