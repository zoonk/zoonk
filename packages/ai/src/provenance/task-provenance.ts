import { type LanguageModelUsage, type ProviderMetadata } from "ai";
import { type CallUsage, computeCallCostUsd } from "../pricing/call-cost";
import { readGatewayMetadata } from "./gateway-metadata";

/** Token counts as the AI SDK reports them, plus the units of calls billed by length or count. */
type TaskUsage = CallUsage & { totalTokens?: number; reasoningTokens?: number };

/**
 * What one AI task run produced its output with. Generated rows store
 * `model`, `promptVersion`, `runId` and `generatedAt`; analytics uses the rest.
 */
export type TaskProvenance = {
  /** The model that actually answered, which is a fallback model when the requested one failed. */
  model: string;
  requestedModel: string;
  /** The provider that served the call, such as `vertex` for a Google model. */
  provider: string;
  promptVersion: string;
  runId: string;
  usage: TaskUsage;
  /**
   * The call's cost in USD at the provider's list price, from its usage and our price list
   * (`computeCallCostUsd`); unknown for a model the list doesn't price.
   */
  costUsd?: number;
  /** AI Gateway's list-price estimate, a cross-check for `costUsd`; unknown off the gateway. */
  gatewayCostUsd?: number;
  /** `flex` or `priority` when one of those tiers served the call; the standard tier is unset. */
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
};

/** The parts of a `generateText` result or a `streamText` end event that provenance reads. */
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

/**
 * A multi-step call is billed per step, and providers may leave a token count out: the total is
 * unknown only when no part reported one.
 */
export function sumKnown(values: readonly (number | undefined)[]): number | undefined {
  const known = values.filter((value) => value !== undefined);

  if (known.length === 0) {
    return undefined;
  }

  return known.reduce((total, value) => total + value, 0);
}

/** The usage of calls that together write one output, such as a question bank written level by level. */
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
 * One provenance for calls that run at the same time to write one output, for the row that stores
 * it: the usage and cost of every call, the slowest call's latency, and every model and provider
 * that answered (more than one when a fallback answered some calls). The calls share a system
 * prompt, so they share a prompt version; the row keeps the first call's run id. Each call still
 * sends its own `$ai_generation` event.
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
      cacheReadTokens: sum((usage) => usage.cacheReadTokens),
      cacheWriteTokens: sum((usage) => usage.cacheWriteTokens),
      inputTokens: sum((usage) => usage.inputTokens),
      outputTokens: sum((usage) => usage.outputTokens),
      reasoningTokens: sum((usage) => usage.reasoningTokens),
      totalTokens: sum((usage) => usage.totalTokens),
    },
  };
}

/**
 * Builds provenance from a finished generation. The model that ran can't come
 * from `response.modelId`: the gateway's `doGenerate` replaces the response
 * metadata with headers and body, so the AI SDK falls back to the requested
 * model id even when a fallback model answered. AI Gateway's routing metadata
 * names the model that answered; `response.modelId` is only the fallback for
 * providers that don't report routing. The cost is priced from the usage at the
 * tier that served the call, since with our own provider keys the gateway bills
 * nothing; its list-price estimate is kept beside it as a cross-check.
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
  const model = gateway.servedModel ?? finalStep.response.modelId;
  const usage = toTaskUsage(generation.usage);

  return {
    costUsd: computeCallCostUsd({ model, serviceTier: gateway.serviceTier, usage }),
    credential: gateway.credential,
    gatewayCostUsd: sumKnown(
      generation.steps.map((step) => readGatewayMetadata(step.providerMetadata).costUsd),
    ),
    generatedAt,
    latencyMs,
    model,
    promptVersion,
    provider: gateway.servedProvider ?? finalStep.model.provider,
    requestedModel: finalStep.model.modelId,
    runId,
    serviceTier: gateway.serviceTier,
    usage,
  };
}
