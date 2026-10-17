import { priceCall } from "@zoonk/ai/pricing/call-cost";
import { type GatewayPrices } from "@zoonk/ai/pricing/gateway-prices";
import { average } from "./math";
import { type TokenUsage } from "./types";

const RUNS_PER_COST_ESTIMATE = 1000;

/** Per-call costs are fractions of a cent, so dashboards compare the cost of 1,000 runs. */
export function estimateCostPer1000Runs(runCosts: number[]): number {
  return average(runCosts) * RUNS_PER_COST_ESTIMATE;
}

/**
 * Prices a call with a gateway model id, the same way the apps price every AI call
 * (`@zoonk/ai/pricing`). Unknown models throw instead of costing zero, since a silent zero would
 * make a model look free.
 */
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
