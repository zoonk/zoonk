import { priceCall } from "@zoonk/ai/pricing/call-cost";
import { type GatewayPrices } from "@zoonk/ai/pricing/gateway-prices";
import { average } from "./math";
import { type TokenUsage } from "./types";

const RUNS_PER_COST_ESTIMATE = 1000;

export function estimateCostPer1000Runs(runCosts: number[]): number {
  return average(runCosts) * RUNS_PER_COST_ESTIMATE;
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
