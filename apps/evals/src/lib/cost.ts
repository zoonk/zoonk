import { priceCall } from "@zoonk/ai/pricing/call-cost";
import { type GatewayPrices } from "@zoonk/ai/pricing/gateway-prices";
import { average, sum } from "./math";
import { type ModelCall, type TokenUsage } from "./types";

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

/** The kept answer at the run's model, plus every draft the run wrote and set aside. */
export function getRunCost({
  modelId,
  prices,
  run,
}: {
  modelId: string;
  prices: GatewayPrices;
  run: TokenUsage & { setAside?: ModelCall[] };
}): number {
  return (
    getCallCost({ modelId, prices, usage: run }) +
    getCallsCost({ calls: run.setAside ?? [], prices })
  );
}
