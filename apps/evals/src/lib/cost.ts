import { priceCall } from "@zoonk/ai/pricing/call-cost";
import { type GatewayPrices } from "@zoonk/ai/pricing/gateway-prices";
import { sum } from "./math";
import { type ModelConfig } from "./models";
import { type FailedRun, type ModelCall, type TokenUsage } from "./types";

const RUNS_PER_COST_ESTIMATE = 1000;

/** A failed run leaves no output, so what it cost is spread over the runs that left one. */
export function estimateCostPer1000Runs({
  failedCost,
  runCosts,
}: {
  failedCost: number;
  runCosts: number[];
}): number {
  if (runCosts.length === 0) {
    return 0;
  }

  return ((sum(runCosts) + failedCost) / runCosts.length) * RUNS_PER_COST_ESTIMATE;
}

/** Throws for unknown model prices so missing pricing cannot make a model look free. */
export function getCallCost({
  modelId,
  prices,
  usage,
}: {
  modelId: string;
  prices: GatewayPrices;
  usage: TokenUsage;
}): number {
  const pricing = prices.models[modelId];

  if (!pricing) {
    throw new Error(`No gateway price for ${modelId}. Run pnpm --filter @zoonk/ai prices:refresh.`);
  }

  return priceCall({ pricing, usage });
}

export function getCallsCost({
  calls,
  prices,
}: {
  calls: ModelCall[];
  prices: GatewayPrices;
}): number {
  return sum(
    calls.map((call) => getCallCost({ modelId: call.modelId, prices, usage: call.usage })),
  );
}

/**
 * Every call a run made. The meter sees only text calls through the default provider, so a model
 * it didn't see (an image, speech, a decision) is priced from the usage its task reported.
 */
export function getRunCost({
  model,
  prices,
  run,
}: {
  model: Pick<ModelConfig, "gatewayModelId">;
  prices: GatewayPrices;
  run: TokenUsage & { calls?: ModelCall[] };
}): number {
  const reported = getCallCost({ modelId: model.gatewayModelId, prices, usage: run });

  if (!run.calls) {
    return reported;
  }

  const metered = getCallsCost({ calls: run.calls, prices });
  const sawModel = run.calls.some((call) => call.modelId === model.gatewayModelId);

  return sawModel ? metered : metered + reported;
}

export function getFailedRunsCost({
  failedRuns = [],
  prices,
}: {
  failedRuns?: FailedRun[];
  prices: GatewayPrices;
}): number {
  return getCallsCost({ calls: failedRuns.flatMap((run) => run.calls ?? []), prices });
}
